const mongoose = require("mongoose")

const mockInterviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    report: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InterviewReport",
        required: true
    },
    
    // Custom setup settings
    companyMode: {
        type: String,
        enum: ["Generic", "Google", "Amazon", "Microsoft", "TCS", "Infosys", "Accenture", "Deloitte"],
        default: "Generic"
    },
    difficulty: {
        type: String,
        enum: ["Easy", "Medium", "Hard"],
        default: "Medium"
    },
    experienceLevel: {
        type: String,
        enum: ["Fresher", "1-2 Years", "3-5 Years"],
        default: "1-2 Years"
    },

    // Timer settings and metrics
    timerMode: {
        type: String,
        enum: ["untimed", "timed"],
        default: "untimed"
    },
    timerLimit: {
        type: Number, // in seconds (e.g. 60, 120, 300)
        default: 0
    },
    timePerQuestion: {
        type: [Number], // array of seconds taken for each question
        default: []
    },
    averageResponseTime: {
        type: Number,
        default: 0
    },

    // Follow-ups settings and conversation history
    enableFollowUps: {
        type: Boolean,
        default: false
    },
    // Array of arrays to represent follow-ups for each of the 8 base questions
    followUpQuestions: {
        type: [[String]],
        default: [[], [], [], [], [], [], [], []]
    },
    followUpAnswers: {
        type: [[String]],
        default: [[], [], [], [], [], [], [], []]
    },
    followUpEvaluations: {
        type: [[mongoose.Schema.Types.Mixed]],
        default: [[], [], [], [], [], [], [], []]
    },
    currentFollowUpCount: {
        type: [Number],
        default: [0, 0, 0, 0, 0, 0, 0, 0]
    },

    // Base questions lists
    questions: [
        {
            question: { type: String, required: true },
            topic: { type: String },
            difficulty: { type: String },
            expectedPoints: [String], // for technical questions
            competency: { type: String }, // for behavioral questions
            answerGuidance: { type: String } // for behavioral questions
        }
    ],
    answers: [
        {
            type: String,
            default: ""
        }
    ],
    evaluations: [
        {
            score: { type: Number },
            strengths: [String],
            improvements: [String],
            betterAnswer: { type: String },
            missingPoints: [String],
            subScores: {
                technicalAccuracy: { type: Number },
                completeness: { type: Number },
                clarity: { type: Number },
                relevance: { type: Number }
            }
        }
    ],

    // Behavioral STAR evaluation criteria (mapped index-wise)
    starScores: [
        {
            situation: { type: Number, default: 0 },
            task: { type: Number, default: 0 },
            action: { type: Number, default: 0 },
            result: { type: Number, default: 0 }
        }
    ],

    // Aggregate analysis details
    score: {
        type: Number,
        default: 0
    },
    technicalAccuracy: {
        type: Number,
        default: 0
    },
    completeness: {
        type: Number,
        default: 0
    },
    clarity: {
        type: Number,
        default: 0
    },
    relevance: {
        type: Number,
        default: 0
    },
    topicScores: {
        type: Map,
        of: Number,
        default: {}
    },
    strengths: [String],
    weaknesses: [String],
    recommendation: [String],
    
    // Personalized study plans (4 weeks)
    studyPlan: [
        {
            week: { type: Number },
            focus: { type: String },
            tasks: { type: [String] }
        }
    ],

    status: {
        type: String,
        enum: ["in-progress", "completed"],
        default: "in-progress"
    },
    completedAt: {
        type: Date
    }
}, { timestamps: true })

module.exports = mongoose.model("MockInterview", mockInterviewSchema)
