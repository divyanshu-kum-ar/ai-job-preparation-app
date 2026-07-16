const { Router } = require("express")
const mockController = require("../controllers/mockInterview.controller")
const authMiddleware = require("../middlewares/auth.middleware")

const mockRouter = Router()

// Protect all mock interview routes
mockRouter.use(authMiddleware.authUser)

mockRouter.post("/start", mockController.startMockInterview)
mockRouter.post("/:id/answer", mockController.answerMockQuestion)
mockRouter.post("/:id/followup", mockController.answerFollowUpQuestion)
mockRouter.post("/:id/complete", mockController.completeMockInterview)
mockRouter.post("/:id/practice-weak", mockController.practiceWeakAreas)
mockRouter.get("/", mockController.getMockInterviews)
mockRouter.get("/:id", mockController.getMockInterviewById)
mockRouter.delete("/:id", mockController.deleteMockInterview)

module.exports = mockRouter
