import express from "express";
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser'

import authroutes from "./routes/auth.route.js";
import { connectDB } from "./lib/db.js";

dotenv.config()

const app = express()

app.use(express.json())
app.use(cookieParser())

const PORT = process.env.PORT || 5001

app.use("/api/auth", authroutes)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
    connectDB()
});