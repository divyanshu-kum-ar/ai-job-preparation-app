const mongoose = require('mongoose');


const technicalQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [ true, "Technical question is required" ]
    },
    topic: {
        type: String,
        default: "General"
    },
    difficulty: {
        type: String,
        default: "Medium"
    },
    expectedPoints: [ {
        type: String
    } ]
}, {
    _id: false
})

const behavioralQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [ true, "Behavioral question is required" ]
    },
    competency: {
        type: String,
        default: "Behavioral"
    },
    answerGuidance: {
        type: String,
        default: ""
    }
}, {
    _id: false
})

const skillGapSchema = new mongoose.Schema({
    skill: {
        type: String,
        required: [ true, "Skill is required" ]
    },
    severity: {
        type: String,
        enum: [ "low", "medium", "high" ],
        required: [ true, "Severity is required" ]
    },
    reason: {
        type: String,
        default: ""
    }
}, {
    _id: false
})

const roadmapSchema = new mongoose.Schema({
    day: {
        type: Number,
        required: [ true, "Day is required" ]
    },
    focus: {
        type: String,
        required: [ true, "Focus is required" ]
    },
    tasks: [ {
        type: String,
        required: [ true, "Task is required" ]
    } ]
}, {
    _id: false
})

const interviewReportSchema = new mongoose.Schema({
    jobDescription: {
        type: String,
        required: [ true, "Job description is required" ]
    },
    resume: {
        type: String,
    },
    selfDescription: {
        type: String,
    },
    matchScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    technicalQuestions: {
        type: [ technicalQuestionSchema ],
        default: []
    },
    behavioralQuestions: {
        type: [ behavioralQuestionSchema ],
        default: []
    },
    skillGaps: {
        type: [ skillGapSchema ],
        default: []
    },
    roadmap: {
        type: [ roadmapSchema ],
        default: []
    },
    preparationPlan: {
        type: Array,
        default: []
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    title: {
        type: String,
        required: [ true, "Job title is required" ]
    }
}, {
    timestamps: true
})


const interviewReportModel = mongoose.model("InterviewReport", interviewReportSchema);

module.exports = interviewReportModel;  