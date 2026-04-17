import { Server } from 'socket.io'
import http from "http"
import express from "express"

const app = express()
const server = http.createServer(app)
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

const io = new Server(server, {
    cors: {
        origin: corsOrigins,
        credentials: true
    }
})

export function getReceiverSocketId(userId)  {
    return userSocketMap[userId]
}

const userSocketMap = {}

const emitToUser = (userId, event, payload) => {
    const receiverSocketId = getReceiverSocketId(userId)
    if (receiverSocketId) {
        io.to(receiverSocketId).emit(event, payload)
    }
}

io.on("connection", (socket) => {
    console.log("A user connected", socket.id)

    const userId = socket.handshake.query.userId
    if(userId) userSocketMap[userId] = socket.id

    io.emit("getOnlineUsers",Object.keys(userSocketMap))

    socket.on("call:request", ({ toUserId, callType = "audio" }) => {
        if (!userId || !toUserId) return
        emitToUser(toUserId, "call:request", { fromUserId: userId, callType })
    })

    socket.on("call:accept", ({ toUserId, callType = "audio" }) => {
        if (!userId || !toUserId) return
        emitToUser(toUserId, "call:accept", { fromUserId: userId, callType })
    })

    socket.on("call:reject", ({ toUserId, reason }) => {
        if (!userId || !toUserId) return
        emitToUser(toUserId, "call:reject", { fromUserId: userId, reason })
    })

    socket.on("call:end", ({ toUserId }) => {
        if (!userId || !toUserId) return
        emitToUser(toUserId, "call:end", { fromUserId: userId })
    })

    socket.on("webrtc:offer", ({ toUserId, offer }) => {
        if (!userId || !toUserId || !offer) return
        emitToUser(toUserId, "webrtc:offer", { fromUserId: userId, offer })
    })

    socket.on("webrtc:answer", ({ toUserId, answer }) => {
        if (!userId || !toUserId || !answer) return
        emitToUser(toUserId, "webrtc:answer", { fromUserId: userId, answer })
    })

    socket.on("webrtc:ice-candidate", ({ toUserId, candidate }) => {
        if (!userId || !toUserId || !candidate) return
        emitToUser(toUserId, "webrtc:ice-candidate", { fromUserId: userId, candidate })
    })

    socket.on("disconnect", () => {
        console.log("A user disconnected", socket.id)
        delete userSocketMap[userId]
        io.emit("getOnlineUsers", Object.keys(userSocketMap))
    })
})

export { io, app, server }
