const multer = require("multer")

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
})

const uploadResume = (req, res, next) => {
    upload.single("resume")(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    message: "File too large"
                })
            }
            return res.status(400).json({
                message: err.message || "Failed to upload file."
            })
        }

        // Validate uploaded file if present
        if (req.file) {
            const allowedMimes = [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ]

            if (!allowedMimes.includes(req.file.mimetype)) {
                return res.status(400).json({
                    message: "Only PDF and DOCX resumes are supported."
                })
            }

            if (!req.file.buffer || req.file.buffer.length === 0) {
                return res.status(400).json({
                    message: "Empty file"
                })
            }
        }

        next()
    })
}

module.exports = {
    upload,
    uploadResume
}