import User from "../models/user.model.js"
import Message from "../models/message.model.js"

import cloudinary from "../lib/cloudinary.js"
import { getReceiverSocketId, io } from "../lib/socket.js"

const EDIT_WINDOW_MS = 15 * 60 * 1000

const emitMessageToParticipants = (message, eventName) => {
    const participantIds = [message.senderId.toString(), message.receiverId.toString()]

    participantIds.forEach((userId) => {
        const socketId = getReceiverSocketId(userId)
        if (socketId) {
            io.to(socketId).emit(eventName, message)
        }
    })
}

export const getUsersForSidebar = async (req,res) => {
    try {
        const loggedInUserId = req.user._id
        const filteredUsers = await User.find({_id: {$ne:loggedInUserId}}).select("-password")
        
        res.status(200).json(filteredUsers)
    } catch (error) {
        console.error("Error in getUsersForSidebar: ", error.message)
        res.status(500).json({ error: "Internal server error" })
    }
}

export const getMessages = async (req,res) => {
    try {
        const {id:userToChatId} = req.params
        const myId = req.user._id

        const messages = await Message.find({
            $or:[
                {senderId:myId, receiverId:userToChatId},
                {senderId:userToChatId, receiverId:myId}
            ]
        })

        res.status(200).json(messages)
    } catch (error) {
        console.log("Error in getMessages controller: ", error.message)
        res.status(500).json({error: "Internal server error"})
    }
}

export const sendMessage = async (req,res) => {
    try {
        const { text = "", image, video } = req.body
        const { id:receiverId } = req.params
        const senderId = req.user._id

        let imageUrl, videoUrl
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image, {resource_type: "image"})
            imageUrl = uploadResponse.secure_url
        }

        if (video) {
            const uploadResponse = await cloudinary.uploader.upload(video, {resource_type: "video"})
            videoUrl = uploadResponse.secure_url
        }

        if (!text.trim() && !imageUrl && !videoUrl) {
            return res.status(400).json({ error: "Message cannot be empty" })
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text: text.trim(),
            image: imageUrl,
            video: videoUrl
        })

        await newMessage.save()

        const receiverSocketId = getReceiverSocketId(receiverId)
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage)
        }

        res.status(201).json(newMessage)
    } catch (error) {
        console.log("Error in sendMessage controller: ", error.message)
        res.status(500).json({error: "Internal server error"})
    }
}

export const updateMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params
        const { text = "" } = req.body
        const userId = req.user._id.toString()

        const trimmedText = text.trim()
        if (!trimmedText) {
            return res.status(400).json({ error: "Message text cannot be empty" })
        }

        const message = await Message.findById(messageId)

        if (!message) {
            return res.status(404).json({ error: "Message not found" })
        }

        if (message.senderId.toString() !== userId) {
            return res.status(403).json({ error: "You can only edit your own messages" })
        }

        if (message.image || message.video) {
            return res.status(403).json({ error: "Media messages cannot be edited" })
        }

        if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
            return res.status(403).json({ error: "Edit window has expired" })
        }

        message.text = trimmedText
        message.editedAt = new Date()
        await message.save()

        emitMessageToParticipants(message, "messageUpdated")
        res.status(200).json(message)
    } catch (error) {
        console.log("Error in updateMessage controller: ", error.message)
        res.status(500).json({ error: "Internal server error" })
    }
}
