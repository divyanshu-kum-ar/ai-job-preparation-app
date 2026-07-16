const mongoose = require("mongoose")
const MockInterview = require("../models/mockInterview.model")
const InterviewReport = require("../models/interviewReport.model")
const {
    generateCustomMockQuestions,
    evaluateMockAnswer,
    generateFollowUpQuestion,
    evaluateFollowUpAnswer,
    generateMockSummary,
    generateWeakTopicQuestions
} = require("../services/ai.service")

async function startMockInterview(req, res) {
    try {
        const {
            reportId,
            companyMode,
            difficulty,
            experienceLevel,
            timerMode,
            timerLimit,
            enableFollowUps
        } = req.body

        if (!reportId) {
            return res.status(400).json({ message: "reportId is required." })
        }

        const report = await InterviewReport.findById(reportId)
        if (!report) {
            return res.status(404).json({ message: "Interview report not found." })
        }

        // Ownership check
        if (report.user.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized access to this report." })
        }

        // Generate customized questions styled for company & difficulty levels dynamically using Gemini
        let mockQuestions
        try {
            const generated = await generateCustomMockQuestions({
                title: report.title,
                jobDescription: report.jobDescription,
                resume: report.resume,
                companyMode: companyMode || "Generic",
                difficulty: difficulty || "Medium",
                experienceLevel: experienceLevel || "1-2 Years"
            })
            
            mockQuestions = [
                ...generated.technicalQuestions.map(q => ({
                    question: q.question,
                    topic: q.topic || "Technical",
                    difficulty: q.difficulty || difficulty || "Medium",
                    expectedPoints: q.expectedPoints || []
                })),
                ...generated.behavioralQuestions.map(q => ({
                    question: q.question,
                    competency: q.competency || "Behavioral",
                    answerGuidance: q.answerGuidance || ""
                }))
            ]
        } catch (aiErr) {
            console.error("AI custom question generation failed, falling back to report questions:", aiErr)
            // Fallback: use report questions
            mockQuestions = [
                ...report.technicalQuestions.slice(0, 5).map(q => ({
                    question: q.question,
                    topic: q.topic || "Technical",
                    difficulty: q.difficulty || "Medium",
                    expectedPoints: q.expectedPoints || []
                })),
                ...report.behavioralQuestions.slice(0, 3).map(q => ({
                    question: q.question,
                    competency: q.competency || "Behavioral",
                    answerGuidance: q.answerGuidance || ""
                }))
            ]
        }

        const mockInterview = await MockInterview.create({
            user: req.user.id,
            report: reportId,
            companyMode: companyMode || "Generic",
            difficulty: difficulty || "Medium",
            experienceLevel: experienceLevel || "1-2 Years",
            timerMode: timerMode || "untimed",
            timerLimit: Number(timerLimit) || 0,
            enableFollowUps: !!enableFollowUps,
            questions: mockQuestions,
            answers: Array(8).fill(""),
            evaluations: Array(8).fill(null),
            timePerQuestion: Array(8).fill(0),
            starScores: Array(8).fill({ situation: 0, task: 0, action: 0, result: 0 }),
            followUpQuestions: Array(8).fill([]),
            followUpAnswers: Array(8).fill([]),
            followUpEvaluations: Array(8).fill([]),
            currentFollowUpCount: Array(8).fill(0),
            score: 0
        })

        res.status(201).json({
            message: "Mock interview started successfully.",
            mockInterview
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to start mock interview." })
    }
}

async function answerMockQuestion(req, res) {
    try {
        const { id } = req.params
        const { questionIndex, answer, timeTaken } = req.body
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid mock interview ID format." })
        }
        const mockInterview = await MockInterview.findById(id)
        if (!mockInterview) {
            return res.status(404).json({ message: "Mock interview not found." })
        }

        if (mockInterview.user.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized access." })
        }

        const idx = Number(questionIndex)
        if (isNaN(idx) || idx < 0 || idx >= mockInterview.questions.length) {
            return res.status(400).json({ message: "Invalid question index." })
        }

        // Store base response and time taken
        const answers = [...mockInterview.answers]
        answers[idx] = answer || ""
        mockInterview.answers = answers

        const timePerQ = [...mockInterview.timePerQuestion]
        timePerQ[idx] = Number(timeTaken) || 0
        mockInterview.timePerQuestion = timePerQ

        const q = mockInterview.questions[idx]
        const isBehavioral = idx >= 5

        // AI evaluation of base response
        let evalResult
        try {
            evalResult = await evaluateMockAnswer({
                question: q.question,
                answer: answer || "Skipped / No Answer",
                expectedPoints: q.expectedPoints || [],
                topic: q.topic || q.competency || "General",
                difficulty: mockInterview.difficulty || "Medium",
                isBehavioral
            })
        } catch (aiErr) {
            console.error("AI Evaluation failed, using fallback:", aiErr)
            evalResult = {
                score: 0,
                strengths: ["N/A"],
                improvements: ["Failed to evaluate due to timeout/API error."],
                betterAnswer: "N/A",
                missingPoints: [],
                subScores: { technicalAccuracy: 0, completeness: 0, clarity: 0, relevance: 0 },
                starRating: { situation: 0, task: 0, action: 0, result: 0 }
            }
        }

        // Save base evaluation
        const evaluations = [...mockInterview.evaluations]
        evaluations[idx] = evalResult
        mockInterview.evaluations = evaluations

        // Save STAR scores if behavioral
        if (isBehavioral && evalResult.starRating) {
            const stars = [...mockInterview.starScores]
            stars[idx] = {
                situation: evalResult.starRating.situation || 0,
                task: evalResult.starRating.task || 0,
                action: evalResult.starRating.action || 0,
                result: evalResult.starRating.result || 0
            }
            mockInterview.starScores = stars
        }

        // Handle dynamic follow-up checks
        let followUpQuestion = ""
        if (mockInterview.enableFollowUps && mockInterview.currentFollowUpCount[idx] < 2 && answer && answer.trim().length > 5) {
            try {
                const followUpData = await generateFollowUpQuestion({
                    question: q.question,
                    answer,
                    previousFollowUps: mockInterview.followUpQuestions[idx]
                })
                
                if (followUpData && followUpData.followUpQuestion) {
                    followUpQuestion = followUpData.followUpQuestion
                    
                    const followUpQs = [...mockInterview.followUpQuestions]
                    followUpQs[idx].push(followUpQuestion)
                    mockInterview.followUpQuestions = followUpQs

                    const counts = [...mockInterview.currentFollowUpCount]
                    counts[idx] += 1
                    mockInterview.currentFollowUpCount = counts
                }
            } catch (followErr) {
                console.error("Failed to generate follow-up question:", followErr)
            }
        }

        await mockInterview.save()

        res.status(200).json({
            message: followUpQuestion ? "Follow-up question generated." : "Answer evaluated.",
            followUpQuestion,
            evaluation: evalResult,
            mockInterview
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to submit answer." })
    }
}

async function answerFollowUpQuestion(req, res) {
    try {
        const { id } = req.params
        const { questionIndex, answer, timeTaken } = req.body
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid mock interview ID format." })
        }
        const mockInterview = await MockInterview.findById(id)
        if (!mockInterview) {
            return res.status(404).json({ message: "Mock interview not found." })
        }

        if (mockInterview.user.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized access." })
        }

        const idx = Number(questionIndex)
        if (isNaN(idx) || idx < 0 || idx >= mockInterview.questions.length) {
            return res.status(400).json({ message: "Invalid question index." })
        }

        const q = mockInterview.questions[idx]
        const followUpCount = mockInterview.currentFollowUpCount[idx]
        if (followUpCount === 0 || mockInterview.followUpQuestions[idx].length === 0) {
            return res.status(400).json({ message: "No active follow-up question for this index." })
        }

        // Save follow-up answer
        const followUpAns = [...mockInterview.followUpAnswers]
        followUpAns[idx].push(answer || "")
        mockInterview.followUpAnswers = followUpAns

        // Add to time taken
        const timePerQ = [...mockInterview.timePerQuestion]
        timePerQ[idx] += Number(timeTaken) || 0
        mockInterview.timePerQuestion = timePerQ

        const currentFollowUpQ = mockInterview.followUpQuestions[idx][followUpCount - 1]

        // Evaluate follow-up
        let evalResult
        try {
            evalResult = await evaluateFollowUpAnswer({
                question: q.question,
                followUpQuestion: currentFollowUpQ,
                followUpAnswer: answer || "Skipped / No Answer"
            })
        } catch (aiErr) {
            console.error("Follow-up evaluation failed, using fallback:", aiErr)
            evalResult = { score: 0, feedback: "Failed to grade due to API issues." }
        }

        const followUpEvals = [...mockInterview.followUpEvaluations]
        followUpEvals[idx].push(evalResult)
        mockInterview.followUpEvaluations = followUpEvals

        // Recalculate base question score by averaging base and follow-up scores
        const baseEvaluation = mockInterview.evaluations[idx]
        if (baseEvaluation) {
            const allFollowUpScores = followUpEvals[idx].map(e => e.score || 0)
            const sumScores = baseEvaluation.score + allFollowUpScores.reduce((a, b) => a + b, 0)
            const totalCount = 1 + allFollowUpScores.length
            baseEvaluation.score = Math.round(sumScores / totalCount)
            
            // Trigger save updates
            const evaluations = [...mockInterview.evaluations]
            evaluations[idx] = baseEvaluation
            mockInterview.evaluations = evaluations
        }

        // Check if we need to ask a SECOND follow-up question
        let followUpQuestion = ""
        if (mockInterview.enableFollowUps && mockInterview.currentFollowUpCount[idx] < 2 && answer && answer.trim().length > 5) {
            try {
                const followUpData = await generateFollowUpQuestion({
                    question: q.question,
                    answer,
                    previousFollowUps: mockInterview.followUpQuestions[idx]
                })
                
                if (followUpData && followUpData.followUpQuestion) {
                    followUpQuestion = followUpData.followUpQuestion
                    
                    const followUpQs = [...mockInterview.followUpQuestions]
                    followUpQs[idx].push(followUpQuestion)
                    mockInterview.followUpQuestions = followUpQs

                    const counts = [...mockInterview.currentFollowUpCount]
                    counts[idx] += 1
                    mockInterview.currentFollowUpCount = counts
                }
            } catch (followErr) {
                console.error("Failed to generate follow-up question:", followErr)
            }
        }

        await mockInterview.save()

        res.status(200).json({
            message: followUpQuestion ? "Next follow-up question generated." : "Follow-up evaluated.",
            followUpQuestion,
            evaluation: evalResult,
            mockInterview
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to submit follow-up response." })
    }
}

async function completeMockInterview(req, res) {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid mock interview ID format." })
        }
        const mockInterview = await MockInterview.findById(id)
        if (!mockInterview) {
            return res.status(404).json({ message: "Mock interview not found." })
        }

        if (mockInterview.user.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized access." })
        }

        // Generate summary details
        let summary
        try {
            summary = await generateMockSummary({
                questions: mockInterview.questions,
                answers: mockInterview.answers,
                evaluations: mockInterview.evaluations
            })
        } catch (aiErr) {
            console.error("AI Summary generation failed, compiling fallback:", aiErr)
            const avgScore = Math.round(mockInterview.evaluations.reduce((sum, item) => sum + (item?.score || 0), 0) / 8 * 10)
            summary = {
                score: avgScore,
                technicalAccuracy: avgScore,
                completeness: avgScore,
                clarity: avgScore,
                relevance: avgScore,
                topicScores: {
                    Java: avgScore, OOP: avgScore, Collections: avgScore, SQL: avgScore,
                    MongoDB: avgScore, RESTAPIs: avgScore, SpringBoot: avgScore, Behavioral: avgScore
                },
                strengths: ["Technical accuracy in role responsibilities"],
                weaknesses: ["Deep-dive core language features"],
                recommendations: ["Revise topic definitions and practice storytelling frameworks."],
                studyPlan: [
                    { week: 1, focus: "Programming Foundations", tasks: ["Revise core definitions", "Solve topic exercises"] },
                    { week: 2, focus: "Database Design & APIs", tasks: ["Practice SQL schemas", "Review REST design guidelines"] },
                    { week: 3, focus: "Framework Depth", tasks: ["Review lifecycle events", "Explain dependency injections"] },
                    { week: 4, focus: "STAR Behavioral Preparation", tasks: ["Write out 3 STAR stories", "Practice presentation delivery"] }
                ]
            }
        }

        // Save calculated statistics
        mockInterview.score = summary.score
        mockInterview.technicalAccuracy = summary.technicalAccuracy
        mockInterview.completeness = summary.completeness
        mockInterview.clarity = summary.clarity
        mockInterview.relevance = summary.relevance
        mockInterview.strengths = summary.strengths
        mockInterview.weaknesses = summary.weaknesses
        mockInterview.recommendation = summary.recommendations
        mockInterview.studyPlan = summary.studyPlan
        
        // Save Map topic scores
        const topicScoresMap = new Map()
        Object.entries(summary.topicScores || {}).forEach(([k, v]) => {
            topicScoresMap.set(k, v)
        })
        mockInterview.topicScores = topicScoresMap

        // Compute average response time
        const validTimes = mockInterview.timePerQuestion.filter(t => t > 0)
        mockInterview.averageResponseTime = validTimes.length > 0
            ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
            : 0

        mockInterview.status = "completed"
        mockInterview.completedAt = new Date()

        await mockInterview.save()

        res.status(200).json({
            message: "Mock interview completed.",
            mockInterview
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to complete mock interview." })
    }
}

async function getMockInterviews(req, res) {
    try {
        const mockInterviews = await MockInterview.find({ user: req.user.id, status: "completed" })
            .populate("report")
            .sort("-completedAt")

        // 1. Calculate Analytics
        const total = mockInterviews.length
        let avgScore = 0
        let highestScore = 0
        let lowestScore = total > 0 ? 100 : 0
        let totalQuestionsAttempted = 0
        let averageResponseTimeTotal = 0
        let responseTimeCount = 0

        mockInterviews.forEach(m => {
            avgScore += m.score
            if (m.score > highestScore) highestScore = m.score
            if (m.score < lowestScore) lowestScore = m.score
            totalQuestionsAttempted += (m.questions || []).length
            if (m.averageResponseTime > 0) {
                averageResponseTimeTotal += m.averageResponseTime
                responseTimeCount++
            }
        })
        avgScore = total > 0 ? Math.round(avgScore / total) : 0
        const avgResponseTime = responseTimeCount > 0 ? Math.round(averageResponseTimeTotal / responseTimeCount) : 0

        // 2. Compute overall improvement trend (+35%)
        let overallImprovement = "+0%"
        if (total >= 2) {
            const first = mockInterviews[total - 1].score
            const last = mockInterviews[0].score
            const diff = last - first
            overallImprovement = (diff >= 0 ? "+" : "") + diff + "%"
        }

        // 3. Compute Streak dynamically from completion dates
        let streakCount = 0
        if (total > 0) {
            const uniqueDates = Array.from(new Set(mockInterviews.map(m => {
                const date = new Date(m.completedAt)
                return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
            }))).sort((a, b) => b - a) // sorted newest first

            const oneDayMs = 24 * 60 * 60 * 1000
            const today = new Date()
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

            // Check if streak is active (completed today or yesterday)
            const latestCompleted = uniqueDates[0]
            if (latestCompleted === todayStart || latestCompleted === (todayStart - oneDayMs)) {
                streakCount = 1
                for (let i = 0; i < uniqueDates.length - 1; i++) {
                    if (uniqueDates[i] - uniqueDates[i+1] === oneDayMs) {
                        streakCount++
                    } else {
                        break
                    }
                }
            }
        }

        // 4. Compute Topic aggregates (Heatmap average)
        const heatmap = { Java: 0, OOP: 0, Collections: 0, SQL: 0, MongoDB: 0, RESTAPIs: 0, SpringBoot: 0, Behavioral: 0 }
        const counts = { Java: 0, OOP: 0, Collections: 0, SQL: 0, MongoDB: 0, RESTAPIs: 0, SpringBoot: 0, Behavioral: 0 }

        mockInterviews.forEach(m => {
            if (m.topicScores) {
                m.topicScores.forEach((v, k) => {
                    const mappedKey = k === "REST APIs" ? "RESTAPIs" : k === "Spring Boot" ? "SpringBoot" : k
                    if (heatmap[mappedKey] !== undefined) {
                        heatmap[mappedKey] += v
                        counts[mappedKey]++
                    }
                })
            }
        })

        // Format heatmap list
        const topicHeatmap = Object.entries(heatmap).map(([topicName, sum]) => {
            const count = counts[topicName] || 0
            const formattedName = topicName === "RESTAPIs" ? "REST APIs" : topicName === "SpringBoot" ? "Spring Boot" : topicName
            return {
                topic: formattedName,
                score: count > 0 ? Math.round(sum / count) : 0
            }
        })

        // Identify strongest / weakest topics
        let strongestTopic = "N/A"
        let weakestTopic = "N/A"
        let maxVal = -1
        let minVal = 101

        topicHeatmap.forEach(item => {
            if (item.score > maxVal && item.score > 0) {
                maxVal = item.score
                strongestTopic = item.topic
            }
            if (item.score < minVal && item.score > 0) {
                minVal = item.score
                weakestTopic = item.topic
            }
        })

        // 5. Badges System
        const badges = []
        let hasJava = false, hasSql = false, hasRest = false, hasBehavioral = false

        mockInterviews.forEach(m => {
            if (m.topicScores) {
                if (m.topicScores.get("Java") >= 85) hasJava = true
                if (m.topicScores.get("SQL") >= 85) hasSql = true
                if (m.topicScores.get("RESTAPIs") >= 85) hasRest = true
                if (m.topicScores.get("Behavioral") >= 85) hasBehavioral = true
            }
        })

        if (hasJava) badges.push({ id: "java_expert", name: "Java Expert", desc: "Score >85% in Java" })
        if (hasSql) badges.push({ id: "sql_master", name: "SQL Master", desc: "Score >85% in SQL" })
        if (hasRest) badges.push({ id: "rest_champion", name: "REST Champion", desc: "Score >85% in REST APIs" })
        if (hasBehavioral) badges.push({ id: "behavioral_pro", name: "Behavioral Pro", desc: "Score >85% in Behavioral" })
        if (total >= 5 || avgScore >= 80) badges.push({ id: "interview_legend", name: "Mock Interview Legend", desc: "Complete 5 mock sessions or average score >80%" })

        res.status(200).json({
            mockInterviews,
            analytics: {
                totalInterviews: total,
                averageScore: avgScore,
                highestScore,
                lowestScore,
                totalQuestionsAttempted,
                averageResponseTime: avgResponseTime,
                overallImprovement,
                currentStreak: streakCount,
                strongestTopic,
                weakestTopic,
                completionRate: total > 0 ? 100 : 0
            },
            topicHeatmap,
            badges
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to fetch mock interviews." })
    }
}

async function getMockInterviewById(req, res) {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid mock interview ID format." })
        }
        const mockInterview = await MockInterview.findById(id).populate("report").populate("user")

        if (!mockInterview) {
            return res.status(404).json({ message: "Mock interview not found." })
        }

        const mockUserId = mockInterview.user?._id ? mockInterview.user._id.toString() : mockInterview.user?.toString()
        if (mockUserId !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized access." })
        }

        res.status(200).json({
            mockInterview
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to fetch mock interview details." })
    }
}

async function deleteMockInterview(req, res) {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid mock interview ID format." })
        }
        const mockInterview = await MockInterview.findById(id)

        if (!mockInterview) {
            return res.status(404).json({ message: "Mock interview not found." })
        }

        if (mockInterview.user.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized access." })
        }

        await mockInterview.deleteOne()

        res.status(200).json({
            message: "Mock interview deleted successfully."
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to delete mock interview." })
    }
}

async function practiceWeakAreas(req, res) {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid mock interview ID format." })
        }
        const mockInterview = await MockInterview.findById(id)
        if (!mockInterview) {
            return res.status(404).json({ message: "Mock interview not found." })
        }
        if (mockInterview.user.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized access." })
        }

        const report = await InterviewReport.findById(mockInterview.report)
        if (!report) {
            return res.status(404).json({ message: "Original strategy report not found." })
        }

        const weakTopics = mockInterview.weaknesses && mockInterview.weaknesses.length > 0
            ? mockInterview.weaknesses
            : ["General Topic Review"]

        let questionsList
        try {
            const generated = await generateWeakTopicQuestions({
                title: report.title,
                weaknesses: weakTopics,
                difficulty: mockInterview.difficulty || "Medium"
            })

            questionsList = (generated.technicalQuestions || []).map(q => ({
                question: q.question,
                topic: q.topic || "Weak Area Practice",
                difficulty: q.difficulty || mockInterview.difficulty || "Medium",
                expectedPoints: q.expectedPoints || []
            }))
        } catch (aiErr) {
            console.error("AI weak areas question generation failed, using fallbacks:", aiErr)
            questionsList = [
                {
                    question: `Explain core concepts and best practices regarding ${weakTopics[0] || 'your weak areas'}.`,
                    topic: weakTopics[0] || "Revision",
                    difficulty: mockInterview.difficulty || "Medium",
                    expectedPoints: []
                }
            ]
        }

        if (questionsList.length === 0) {
            questionsList = [
                {
                    question: `Explain core concepts and best practices regarding ${weakTopics[0] || 'your weak areas'}.`,
                    topic: weakTopics[0] || "Revision",
                    difficulty: mockInterview.difficulty || "Medium",
                    expectedPoints: []
                }
            ]
        }

        const newMockInterview = await MockInterview.create({
            user: req.user.id,
            report: mockInterview.report,
            companyMode: mockInterview.companyMode,
            difficulty: mockInterview.difficulty,
            experienceLevel: mockInterview.experienceLevel,
            timerMode: mockInterview.timerMode,
            timerLimit: mockInterview.timerLimit,
            enableFollowUps: mockInterview.enableFollowUps,
            questions: questionsList,
            answers: Array(questionsList.length).fill(""),
            evaluations: Array(questionsList.length).fill(null),
            timePerQuestion: Array(questionsList.length).fill(0),
            starScores: Array(questionsList.length).fill({ situation: 0, task: 0, action: 0, result: 0 }),
            followUpQuestions: Array(questionsList.length).fill([]),
            followUpAnswers: Array(questionsList.length).fill([]),
            followUpEvaluations: Array(questionsList.length).fill([]),
            currentFollowUpCount: Array(questionsList.length).fill(0),
            score: 0
        })

        res.status(201).json({
            message: "Practice session for weak areas started successfully.",
            mockInterview: newMockInterview
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to generate weak topics practice session." })
    }
}

module.exports = {
    startMockInterview,
    answerMockQuestion,
    answerFollowUpQuestion,
    completeMockInterview,
    getMockInterviews,
    getMockInterviewById,
    deleteMockInterview,
    practiceWeakAreas
}
