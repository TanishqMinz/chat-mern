import express from "express"

import { protectRoute } from "../middleware/auth.middleware.js"
import { getSmartReplies, rewriteMessage, translateMessage } from "../controllers/ai.controller.js"

const router = express.Router()

router.post("/smart-replies", protectRoute, getSmartReplies)
router.post("/rewrite", protectRoute, rewriteMessage)
router.post("/translate", protectRoute, translateMessage)

export default router
