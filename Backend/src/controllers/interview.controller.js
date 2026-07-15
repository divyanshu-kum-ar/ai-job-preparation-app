const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { generateInterviewReport, normalizeInterviewReport, generateResumePdf, generateResumeHtml, generatePdfFromHtml } = require("../services/ai.service");
const interviewReportModel = require("../models/interviewReport.model");

/**
 * @description Controller to generate interview report
 */
async function generateInterViewReportController(req, res) {
    try {
        const { selfDescription, jobDescription, title } = req.body;
        const resumeFile = req.file;

        // ✅ Validate: At least one of resume or self description is required
        if (!resumeFile && (!selfDescription || !selfDescription.trim())) {
            return res.status(400).json({
                message: "Resume or Self Description is required."
            });
        }

        if (!title || !title.trim()) {
            return res.status(400).json({
                message: "Title is required"
            });
        }

        if (!jobDescription || !jobDescription.trim()) {
            return res.status(400).json({
                message: "Job description is required"
            });
        }

        let resumeText = "";

        // ✅ Parse file if present
        if (resumeFile) {
            if (resumeFile.mimetype === "application/pdf") {
                try {
                    const pdfData = await pdfParse(resumeFile.buffer);
                    resumeText = pdfData?.text?.trim() || "";
                } catch (err) {
                    console.error("PDF parse error:", err);
                    return res.status(400).json({
                        message: "Failed to extract text"
                    });
                }
            } else if (resumeFile.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                try {
                    const docxResult = await mammoth.extractRawText({ buffer: resumeFile.buffer });
                    resumeText = docxResult?.value?.trim() || "";
                } catch (err) {
                    console.error("DOCX parse error:", err);
                    return res.status(400).json({
                        message: "Failed to extract text"
                    });
                }
            } else {
                return res.status(400).json({
                    message: "Only PDF and DOCX resumes are supported."
                });
            }

            if (!resumeText) {
                return res.status(400).json({
                    message: "Failed to extract text"
                });
            }
        }

        // ✅ Merge profile text before AI processing
        let finalResume = "";
        let finalSelfDescription = "";

        if (resumeText && selfDescription && selfDescription.trim()) {
            finalResume = `Resume Content:\n${resumeText}\n\nCandidate Self Description:\n${selfDescription}`;
            finalSelfDescription = "";
        } else if (resumeText) {
            finalResume = resumeText;
        } else {
            finalSelfDescription = selfDescription;
        }

        // ✅ Call AI service
        const interViewReportByAi = await generateInterviewReport({
            resume: finalResume,
            selfDescription: finalSelfDescription,
            jobDescription
        });

        // ✅ Save to DB (User-entered title overrides AI title)
        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...interViewReportByAi,
            title
        });

        const normalizedReport = {
            ...interviewReport.toObject(),
            ...normalizeInterviewReport(interviewReport.toObject())
        };

        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport: normalizedReport
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

        const interviewReport = await interviewReportModel.findById(interviewId);

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        if (interviewReport.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Forbidden: You do not own this report."
            });
        }

        const normalizedReport = {
            ...interviewReport.toObject(),
            ...normalizeInterviewReport(interviewReport.toObject())
        };

        return res.status(200).json({
            message: "Interview report fetched successfully.",
            interviewReport: normalizedReport
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

        if (interviewReport.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Forbidden: You do not own this report."
            });
        }

        let pdfBuffer;
        let htmlContent = req.body && req.body.html;

        if (htmlContent) {
            pdfBuffer = await generatePdfFromHtml(htmlContent);
        } else {
            const { resume, jobDescription, selfDescription } = interviewReport;
            pdfBuffer = await generateResumePdf({
                resume,
                jobDescription,
                selfDescription
            });
        }

        let filename = `resume_${interviewReportId}.pdf`;
        if (htmlContent) {
            const match = htmlContent.match(/<h1[^>]*class=["']candidate-name["'][^>]*>([^<]+)<\/h1>/i);
            if (match && match[1]) {
                const name = match[1].trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
                if (name) {
                    filename = `${name}_ATS_Resume.pdf`;
                }
            }
        } else if (interviewReport.title) {
            const cleanTitle = interviewReport.title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
            filename = `${cleanTitle}_ATS_Resume.pdf`;
        }

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`
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

/**
 * @description Generate Resume HTML
 */
async function generateResumeHtmlController(req, res) {
    try {
        const { interviewReportId } = req.params;

        const interviewReport = await interviewReportModel.findById(interviewReportId);

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        if (interviewReport.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Forbidden: You do not own this report."
            });
        }

        const { resume, jobDescription, selfDescription } = interviewReport;

        const htmlContent = await generateResumeHtml({
            resume,
            jobDescription,
            selfDescription
        });

        return res.status(200).json({
            html: htmlContent
        });

    } catch (error) {
        console.error("❌ ERROR in generateResumeHtmlController:", error);

        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
}

/**
 * @description Delete interview report
 */
async function deleteInterviewReportController(req, res) {
    try {
        const { interviewId } = req.params;

        const interviewReport = await interviewReportModel.findById(interviewId);

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        if (interviewReport.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Forbidden: You do not own this report."
            });
        }

        await interviewReportModel.findByIdAndDelete(interviewId);

        return res.status(200).json({
            message: "Interview report deleted successfully."
        });

    } catch (error) {
        console.error("❌ ERROR in deleteInterviewReportController:", error);

        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
}

/**
 * @description Regenerate interview report
 */
async function regenerateInterviewReportController(req, res) {
    try {
        const { interviewId } = req.params;

        const interviewReport = await interviewReportModel.findById(interviewId);

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            });
        }

        if (interviewReport.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Forbidden: You do not own this report."
            });
        }

        let finalResume = "";
        let finalSelfDescription = "";
        const resumeText = interviewReport.resume || "";
        const selfDescription = interviewReport.selfDescription || "";

        if (resumeText && selfDescription && selfDescription.trim()) {
            finalResume = `Resume Content:\n${resumeText}\n\nCandidate Self Description:\n${selfDescription}`;
            finalSelfDescription = "";
        } else if (resumeText) {
            finalResume = resumeText;
        } else {
            finalSelfDescription = selfDescription;
        }

        const interViewReportByAi = await generateInterviewReport({
            resume: finalResume,
            selfDescription: finalSelfDescription,
            jobDescription: interviewReport.jobDescription
        });

        // Update existing report with new AI content (retaining metadata)
        Object.assign(interviewReport, interViewReportByAi);
        await interviewReport.save();

        const normalizedReport = {
            ...interviewReport.toObject(),
            ...normalizeInterviewReport(interviewReport.toObject())
        };

        return res.status(200).json({
            message: "Interview report regenerated successfully.",
            interviewReport: normalizedReport
        });

    } catch (error) {
        console.error("❌ ERROR in regenerateInterviewReportController:", error);

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
    generateResumePdfController,
    generateResumeHtmlController,
    deleteInterviewReportController,
    regenerateInterviewReportController
};