import { FeedbackService } from "./feedback.service"
import { FeedbackController } from "./feedback.controller"

const feedbackService = new FeedbackService()

export const feedbackController = new FeedbackController(feedbackService)