import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { getMockInterview, submitMockAnswer, submitFollowUpAnswer, completeMockInterview } from '../services/mock.api'
import '../style/interview.scss'

const MockInterview = () => {
    const { id } = useParams()
    const navigate = useNavigate()

    const [mockInterview, setMockInterview] = useState(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [answerText, setAnswerText] = useState("")
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [loadingMsg, setLoadingMsg] = useState("Loading Mock Interview...")
    const [error, setError] = useState(null)

    // Dynamic Follow-up State
    const [activeFollowUpQuestion, setActiveFollowUpQuestion] = useState("")

    // Response Timers
    const [secondsElapsed, setSecondsElapsed] = useState(0) // total session time
    const [timeRemaining, setTimeRemaining] = useState(0)   // current question timer
    const [timeTakenForQuestion, setTimeTakenForQuestion] = useState(0) // time spent on current base/followup

    // Session Timer effect
    useEffect(() => {
        const interval = setInterval(() => {
            setSecondsElapsed(s => s + 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    // Question Timer effect
    useEffect(() => {
        if (loading || submitting || !mockInterview) return

        if (mockInterview.timerMode === "timed") {
            const limit = mockInterview.timerLimit || 120
            setTimeRemaining(limit)
        }
        setTimeTakenForQuestion(0)
    }, [currentIndex, activeFollowUpQuestion, loading, mockInterview])

    // Countdown / Tick effect
    useEffect(() => {
        if (loading || submitting || !mockInterview) return

        const timer = setInterval(() => {
            setTimeTakenForQuestion(t => t + 1)

            if (mockInterview.timerMode === "timed") {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        clearInterval(timer)
                        // Trigger auto-submit
                        handleAutoSubmit()
                        return 0
                    }
                    return prev - 1
                })
            }
        }, 1000)

        return () => clearInterval(timer)
    }, [currentIndex, activeFollowUpQuestion, loading, submitting, mockInterview])

    const handleAutoSubmit = () => {
        // Auto submit whatever text is in the answer text, or skip
        if (activeFollowUpQuestion) {
            handleFollowUpSubmit(false)
        } else {
            handleAnswerSubmit(false)
        }
    }

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0')
        const s = (secs % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    const fetchDetails = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await getMockInterview(id)
            if (data && data.mockInterview) {
                setMockInterview(data.mockInterview)
                
                // Determine current base question index
                const answers = data.mockInterview.answers || []
                const totalQuestionsCount = data.mockInterview.questions?.length || 8
                let firstUnanswered = 0
                for (let i = 0; i < totalQuestionsCount; i++) {
                    if (answers[i] === "" && (!data.mockInterview.evaluations || !data.mockInterview.evaluations[i])) {
                        firstUnanswered = i
                        break
                    }
                    firstUnanswered = i + 1
                }
                
                // Determine if there is an active incomplete follow-up
                if (firstUnanswered < totalQuestionsCount) {
                    const mock = data.mockInterview
                    const currentFollowUpCount = mock.currentFollowUpCount[firstUnanswered] || 0
                    const followUpQs = mock.followUpQuestions[firstUnanswered] || []
                    const followUpAns = mock.followUpAnswers[firstUnanswered] || []
                    
                    if (followUpQs.length > followUpAns.length) {
                        // There is an unanswered follow-up question
                        setActiveFollowUpQuestion(followUpQs[followUpAns.length])
                    }
                }

                setCurrentIndex(firstUnanswered >= totalQuestionsCount ? totalQuestionsCount - 1 : firstUnanswered)
                
                if (data.mockInterview.status === "completed") {
                    navigate(`/mock/${id}/summary`)
                }
            }
        } catch (err) {
            console.error(err)
            setError(err.response?.data?.message || "Failed to load mock interview session.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDetails()
    }, [id])

    const handleAnswerSubmit = async (skip = false) => {
        const answerVal = skip ? "" : answerText.trim()
        if (!skip && !answerVal && mockInterview.timerMode !== "timed") {
            alert("Please type your response or click Skip.")
            return
        }

        setSubmitting(true)
        setLoadingMsg("Evaluating Answer...")
        try {
            const data = await submitMockAnswer(id, currentIndex, answerVal, timeTakenForQuestion)
            if (data && data.mockInterview) {
                setMockInterview(data.mockInterview)
                setAnswerText("")
                
                // Check if a dynamic follow-up was generated
                if (data.followUpQuestion) {
                    setActiveFollowUpQuestion(data.followUpQuestion)
                } else {
                    // Move to next question index
                    const nextIdx = currentIndex + 1
                    const totalQ = mockInterview?.questions?.length || 8
                    if (nextIdx >= totalQ) {
                        setLoadingMsg("Preparing Final Report...")
                        const finalData = await completeMockInterview(id)
                        if (finalData && finalData.mockInterview) {
                            navigate(`/mock/${id}/summary`)
                        }
                    } else {
                        setCurrentIndex(nextIdx)
                    }
                }
            }
        } catch (err) {
            console.error(err)
            alert(err.response?.data?.message || "Failed to submit response. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    const handleFollowUpSubmit = async (skip = false) => {
        const answerVal = skip ? "" : answerText.trim()
        if (!skip && !answerVal && mockInterview.timerMode !== "timed") {
            alert("Please type your follow-up answer or click Skip.")
            return
        }

        setSubmitting(true)
        setLoadingMsg("Evaluating Follow-Up response...")
        try {
            const data = await submitFollowUpAnswer(id, currentIndex, answerVal, timeTakenForQuestion)
            if (data && data.mockInterview) {
                setMockInterview(data.mockInterview)
                setAnswerText("")

                // Check if another follow-up question is prompted
                if (data.followUpQuestion) {
                    setActiveFollowUpQuestion(data.followUpQuestion)
                } else {
                    // Follow-ups complete. Move to the next base question.
                    setActiveFollowUpQuestion("")
                    const nextIdx = currentIndex + 1
                    const totalQ = mockInterview?.questions?.length || 8
                    if (nextIdx >= totalQ) {
                        setLoadingMsg("Preparing Final Report...")
                        const finalData = await completeMockInterview(id)
                        if (finalData && finalData.mockInterview) {
                            navigate(`/mock/${id}/summary`)
                        }
                    } else {
                        setCurrentIndex(nextIdx)
                    }
                }
            }
        } catch (err) {
            console.error(err)
            alert(err.response?.data?.message || "Failed to submit follow-up response. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading || submitting) {
        return (
            <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d15', color: '#fff', gap: '1.5rem' }}>
                <div className="spinner" style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #e1034d', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '500', color: '#aaa', margin: 0 }}>{loadingMsg}</h2>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </main>
        )
    }

    if (error) {
        return (
            <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d15', color: '#fff', padding: '2rem', textAlign: 'center' }}>
                <h1 style={{ color: '#e1034d', fontSize: '1.8rem', marginBottom: '1rem' }}>Session Error</h1>
                <p style={{ color: '#aaa', marginBottom: '2rem' }}>{error}</p>
                <button onClick={() => navigate(-1)} className="button secondary-button">Go Back</button>
            </main>
        )
    }

    const currentQuestion = mockInterview?.questions[currentIndex]
    const totalQ = mockInterview?.questions?.length || 8
    const progressPercent = Math.round((currentIndex / totalQ) * 100)
    const isTimedMode = mockInterview?.timerMode === "timed"
    const timerWarning = isTimedMode && timeRemaining <= 15

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0f', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Header Card */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a2e', paddingBottom: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', margin: 0, color: '#fff' }}>AI Mock Interview</h1>
                        <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.2rem 0 0 0' }}>Job Target: {mockInterview?.report?.title || "Target Role"} | Company Target: {mockInterview?.companyMode}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        
                        {/* Time Remaining Timer Badge (if timed mode) */}
                        {isTimedMode && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backgroundColor: timerWarning ? 'rgba(255, 45, 120, 0.1)' : '#16162a',
                                border: timerWarning ? '1px solid #ff2d78' : '1px solid #1c1c3a',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.85rem',
                                color: timerWarning ? '#ff2d78' : '#fff',
                                fontWeight: '600',
                                animation: timerWarning ? 'pulse 1s infinite' : 'none'
                            }}>
                                <span>Time Remaining: {formatTime(timeRemaining)}</span>
                            </div>
                        )}

                        {/* Overall Session Duration Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#16162a', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#ccc' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e1034d' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>Duration: {formatTime(secondsElapsed)}</span>
                        </div>
                    </div>
                </header>

                {/* Progress bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888' }}>
                        <span>Question {currentIndex + 1} of {totalQ}</span>
                        <span>{progressPercent}% Complete</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#1a1a2e', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#e1034d', transition: 'width 0.4s ease' }} />
                    </div>
                </div>

                {/* Current Question Block */}
                {currentQuestion && (
                    <div style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '1rem', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* Question Metadata tags */}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {currentQuestion.topic && (
                                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: '0.35rem', fontWeight: '500' }}>
                                    Topic: {currentQuestion.topic}
                                </span>
                            )}
                            {currentQuestion.competency && (
                                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: 'rgba(139,92,246,0.1)', color: '#8b5cf6', borderRadius: '0.35rem', fontWeight: '500' }}>
                                    Competency: {currentQuestion.competency}
                                </span>
                            )}
                            {currentQuestion.difficulty && (
                                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '0.35rem', fontWeight: '500' }}>
                                    Difficulty: {currentQuestion.difficulty}
                                </span>
                            )}
                        </div>

                        {/* Question Text or AI Follow-Up block */}
                        {activeFollowUpQuestion ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'rgba(225,3,77,0.05)', border: '1px dashed rgba(225,3,77,0.3)', padding: '1rem', borderRadius: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', color: '#ff2d78', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Follow-Up Question</span>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>{activeFollowUpQuestion}</h3>
                                <p style={{ fontSize: '0.75rem', color: '#888', margin: '0.25rem 0 0 0' }}>Context: probing deeper into your previous answer.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', color: '#e1034d', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Question</span>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '500', lineHeight: '1.5', margin: 0 }}>{currentQuestion.question}</h2>
                                {currentQuestion.answerGuidance && (
                                    <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.25rem 0 0 0' }}>Guidance: {currentQuestion.answerGuidance}</p>
                                )}
                            </div>
                        )}

                        {/* Text Area for Response */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label htmlFor="user-response" style={{ fontSize: '0.85rem', color: '#888' }}>
                                {activeFollowUpQuestion ? "Your Follow-Up Response" : "Your Response"}
                            </label>
                            <textarea
                                id="user-response"
                                value={answerText}
                                onChange={(e) => setAnswerText(e.target.value)}
                                placeholder="Type your response here..."
                                rows={6}
                                style={{
                                    width: '100%',
                                    backgroundColor: '#0a0a0f',
                                    border: '1px solid #1c1c3a',
                                    borderRadius: '0.75rem',
                                    color: '#fff',
                                    padding: '1rem',
                                    fontSize: '0.95rem',
                                    lineHeight: '1.5',
                                    outline: 'none',
                                    resize: 'vertical',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                            <button
                                onClick={() => activeFollowUpQuestion ? handleFollowUpSubmit(true) : handleAnswerSubmit(true)}
                                className="button secondary-button"
                                style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem' }}
                            >
                                Skip
                            </button>
                            <button
                                onClick={() => activeFollowUpQuestion ? handleFollowUpSubmit(false) : handleAnswerSubmit(false)}
                                className="button primary-button"
                                style={{ padding: '0.6rem 1.8rem', fontSize: '0.85rem' }}
                            >
                                {activeFollowUpQuestion ? "Submit Follow-Up" : "Submit Answer"}
                            </button>
                        </div>

                    </div>
                )}

                {/* Previous Answers & Evaluations section */}
                {mockInterview?.evaluations && mockInterview.evaluations.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '500', borderBottom: '1px solid #1a1a2e', paddingBottom: '0.5rem', color: '#aaa', margin: 0 }}>Previous Answers & Evaluation</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {mockInterview.questions.slice(0, currentIndex).map((q, idx) => {
                                const evaluation = mockInterview.evaluations[idx]
                                const answer = mockInterview.answers[idx]
                                if (!evaluation) return null
                                
                                return (
                                    <div key={idx} style={{ backgroundColor: '#111120', border: '1px solid #1c1c3a', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#e1034d', fontWeight: '500' }}>Q{idx + 1}: {q.topic || q.competency}</span>
                                            <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(225, 3, 77, 0.1)', color: '#e1034d', padding: '0.2rem 0.5rem', borderRadius: '0.35rem', fontWeight: '600' }}>
                                                Score: {evaluation.score}/10
                                            </span>
                                        </div>
                                        
                                        <p style={{ fontSize: '0.85rem', color: '#fff', margin: 0, fontWeight: '500' }}>"{q.question}"</p>
                                        
                                        <div style={{ fontSize: '0.8rem', color: '#888', borderLeft: '2px solid #e1034d', paddingLeft: '0.75rem', margin: '0.25rem 0' }}>
                                            <strong>Your Answer:</strong> {answer || <em style={{ color: '#666' }}>Skipped</em>}
                                        </div>

                                        {/* Follow-up string details if answered */}
                                        {mockInterview.followUpQuestions[idx]?.length > 0 && (
                                            <div style={{ margin: '0.25rem 0', backgroundColor: '#0a0a0f', padding: '0.5rem', borderRadius: '0.35rem' }}>
                                                {mockInterview.followUpQuestions[idx].map((fq, fidx) => {
                                                    const fa = mockInterview.followUpAnswers[idx]?.[fidx]
                                                    return (
                                                        <div key={fidx} style={{ fontSize: '0.75rem', color: '#aaa', marginTop: fidx > 0 ? '0.4rem' : 0 }}>
                                                            <strong style={{ color: '#ff2d78' }}>AI Follow-Up {fidx + 1}:</strong> "{fq}"<br />
                                                            <strong style={{ color: '#aaa' }}>Your Answer:</strong> {fa || <em style={{ color: '#666' }}>Skipped</em>}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {evaluation.strengths && evaluation.strengths.length > 0 && (
                                            <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                                                <strong style={{ color: '#10b981' }}>Strengths:</strong> {evaluation.strengths.join(", ")}
                                            </div>
                                        )}

                                        {evaluation.improvements && evaluation.improvements.length > 0 && (
                                            <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                                                <strong style={{ color: '#e1034d' }}>Improvements:</strong> {evaluation.improvements.join(", ")}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

            </div>
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    )
}

export default MockInterview
