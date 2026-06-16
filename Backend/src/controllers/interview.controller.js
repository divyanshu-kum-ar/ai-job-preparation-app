const pdfParse = require("pdf-parse");
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service");
const interviewReportModel = require("../models/interviewReport.model");

/**
 * @description Controller to generate interview report
 */
async function generateInterViewReportController(req, res) {
    try {
        // 🔍 Debug (optional - remove later)
        console.log("BODY:", req.body);
        console.log("FILE:", req.file);

        // ✅ Validate file
        if (!req.file) {
            return res.status(400).json({
                message: "Resume PDF file is required"
            });
        }

        // ✅ Parse PDF correctly
        const pdfData = await pdfParse(req.file.buffer);
        const resumeText = pdfData?.text?.trim();

        // ✅ Extract fields
        const { selfDescription, jobDescription, title } = req.body;

        if (!resumeText) {
            return res.status(400).json({
                message: "Unable to parse text from the uploaded resume PDF. Please upload a valid PDF file."
            });
        }

        // ✅ Validate required fields
        if (!title) {
            return res.status(400).json({
                message: "Title is required"
            });
        }

        if (!selfDescription || !jobDescription) {
            return res.status(400).json({
                message: "Self description and job description are required"
            });
        }

        // ✅ Call AI service
        const interViewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription,
            jobDescription
        });

        // ✅ Save to DB
        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            title,
            resume: pdfData.text,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        });

        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        });

    } catch (error) {
        console.error("❌ ERROR in generateInterViewReportController:", error);

        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
}

/**
 * @description Get interview report by ID
 */
async function getInterviewReportByIdController(req, res) {
    try {
        const { interviewId } = req.params;

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewId,
            user: req.user.id
        });

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        return res.status(200).json({
            message: "Interview report fetched successfully.",
            interviewReport
        });

    } catch (error) {
        console.error("❌ ERROR in getInterviewReportByIdController:", error);

        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
}

/**
 * @description Get all interview reports
 */
async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = await interviewReportModel
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan");

        return res.status(200).json({
            message: "Interview reports fetched successfully.",
            interviewReports
        });

    } catch (error) {
        console.error("❌ ERROR in getAllInterviewReportsController:", error);

        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
}

/**
 * @description Generate Resume PDF
 */
async function generateResumePdfController(req, res) {
    try {
        const { interviewReportId } = req.params;

        const interviewReport = await interviewReportModel.findById(interviewReportId);

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        const { resume, jobDescription, selfDescription } = interviewReport;

        const pdfBuffer = await generateResumePdf({
            resume,
            jobDescription,
            selfDescription
        });

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        });

        return res.send(pdfBuffer);

    } catch (error) {
        console.error("❌ ERROR in generateResumePdfController:", error);

        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
}

module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController
};