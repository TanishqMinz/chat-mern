import express from "express";
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser'
import cors from "cors"

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { connectDB } from "./lib/db.js";

dotenv.config()

const app = express()

app.use(express.json())
app.use(cookieParser())

// remember to change origin after deploying
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
})
)

const PORT = process.env.PORT || 5001

app.use("/api/auth", authRoutes)
app.use("/api/message", messageRoutes)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
    connectDB()
});