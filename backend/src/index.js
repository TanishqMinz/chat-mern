import express from "express";
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser'
import cors from "cors"

import path from "path"

import authRoutes from "./routes/auth.route.js";
import aiRoutes from "./routes/ai.route.js";
import messageRoutes from "./routes/message.route.js";
import { connectDB } from "./lib/db.js";
import { app, server } from "./lib/socket.js";

dotenv.config()
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)



app.use(express.json({limit: '10MB'}))
app.use(cookieParser())

// remember to change origin after deploying
app.use(cors({
    origin: corsOrigins,
    credentials: true
})
)

app.use((req, res, next) => {
    res.setHeader("Permissions-Policy", "microphone=(self)")
    next()
})

const PORT = process.env.PORT || 5001
const __dirname = path.resolve()

app.use("/api/auth", authRoutes)
app.use("/api/ai", aiRoutes)
app.use("/api/messages", messageRoutes)

if(process.env.NODE_ENV==="production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")))

    app.get("*", (req,res) => {
        res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"))
    })
}

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
    connectDB()
});
