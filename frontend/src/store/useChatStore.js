import { create } from "zustand";
import { toast } from "react-hot-toast"

import { axiosInstance } from "../lib/axios"

import { useAuthStore } from "./useAuthStore"


export const useChatStore = create((set,get) => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    callState: "idle", // idle | calling | incoming | in-call
    callUserId: null,
    incomingCallFrom: null,
    localStream: null,
    remoteStream: null,
    peerConnection: null,
    pendingOffer: null,

    getUsers: async () => {
        set({ isUsersLoading: true })
        try {
            const res = await axiosInstance.get("/messages/users")
            set({ users:res.data })
        } catch (error) {
            toast.error(error.response.data.message)
        } finally {
            set({ isUsersLoading: false })
        }
    },

    getMessages: async (userId) => {
        set({ isMessagesLoading: true })
        try {
            const res = await axiosInstance.get(`/messages/${userId}`)
            set({ messages: res.data })
        } catch (error) {
            toast.error(error.response.data.message)
        } finally {
            set({ isMessagesLoading: false })
        }
    },

    sendMessage: async (messageData) => {
        const {selectedUser, messages} = get()
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData)
            set({ messages:[...messages,res.data] })
        } catch (error) {
            toast.error(error.response.data.message)
        }
    },

    subscribeToMessages: () => {
        const { selectedUser } = get()
        if(!selectedUser) return

        const socket = useAuthStore.getState().socket

        socket.on("newMessage", (newMessage) => {
            const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id
            if (!isMessageSentFromSelectedUser) return
            set({ 
                messages: [...get().messages, newMessage]
             })
        })
    },

    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket
        socket.off("newMessage")
    },

    subscribeToCalls: () => {
        const socket = useAuthStore.getState().socket
        if (!socket) return

        socket.off("call:request")
        socket.off("call:accept")
        socket.off("call:reject")
        socket.off("call:end")
        socket.off("webrtc:offer")
        socket.off("webrtc:answer")
        socket.off("webrtc:ice-candidate")

        socket.on("call:request", ({ fromUserId }) => {
            const { callState } = get()
            if (callState !== "idle") {
                socket.emit("call:reject", { toUserId: fromUserId })
                return
            }
            set({ callState: "incoming", incomingCallFrom: fromUserId, callUserId: fromUserId })
        })

        socket.on("call:accept", async ({ fromUserId }) => {
            const { callState, callUserId, peerConnection, localStream } = get()
            if (callState !== "calling" || callUserId !== fromUserId || !peerConnection || !localStream) return

            const offer = await peerConnection.createOffer()
            await peerConnection.setLocalDescription(offer)
            socket.emit("webrtc:offer", { toUserId: fromUserId, offer })
            set({ callState: "in-call" })
        })

        socket.on("call:reject", ({ fromUserId }) => {
            const { callUserId } = get()
            if (callUserId !== fromUserId) return
            get().cleanupCall()
            toast.error("Call rejected")
        })

        socket.on("call:end", ({ fromUserId }) => {
            const { callUserId } = get()
            if (callUserId !== fromUserId) return
            get().cleanupCall()
            toast("Call ended")
        })

        socket.on("webrtc:offer", async ({ fromUserId, offer }) => {
            const { peerConnection, callState } = get()
            if (callState !== "incoming" && callState !== "in-call") return

            if (!peerConnection) {
                set({ pendingOffer: { fromUserId, offer } })
                return
            }
            await peerConnection.setRemoteDescription(offer)
            const answer = await peerConnection.createAnswer()
            await peerConnection.setLocalDescription(answer)
            socket.emit("webrtc:answer", { toUserId: fromUserId, answer })
        })

        socket.on("webrtc:answer", async ({ fromUserId, answer }) => {
            const { peerConnection, callUserId } = get()
            if (!peerConnection || callUserId !== fromUserId) return
            await peerConnection.setRemoteDescription(answer)
        })

        socket.on("webrtc:ice-candidate", async ({ fromUserId, candidate }) => {
            const { peerConnection, callUserId } = get()
            if (!peerConnection || callUserId !== fromUserId) return
            try {
                await peerConnection.addIceCandidate(candidate)
            } catch (error) {
                console.error("ICE candidate error", error)
            }
        })
    },

    unsubscribeFromCalls: () => {
        const socket = useAuthStore.getState().socket
        if (!socket) return
        socket.off("call:request")
        socket.off("call:accept")
        socket.off("call:reject")
        socket.off("call:end")
        socket.off("webrtc:offer")
        socket.off("webrtc:answer")
        socket.off("webrtc:ice-candidate")
    },

    setupPeerConnection: (remoteUserId) => {
        const socket = useAuthStore.getState().socket
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:global.stun.twilio.com:3478?transport=udp" }
            ]
        })

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("webrtc:ice-candidate", { toUserId: remoteUserId, candidate: event.candidate })
            }
        }

        peerConnection.ontrack = (event) => {
            set({ remoteStream: event.streams[0] })
        }

        set({ peerConnection })
        return peerConnection
    },

    startCall: async () => {
        const { selectedUser, callState } = get()
        const socket = useAuthStore.getState().socket
        if (!selectedUser || !socket) return
        if (callState !== "idle") return

        try {
            const localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const peerConnection = get().setupPeerConnection(selectedUser._id)
            localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))

            set({
                localStream,
                callState: "calling",
                callUserId: selectedUser._id,
                incomingCallFrom: null
            })

            socket.emit("call:request", { toUserId: selectedUser._id })
        } catch (error) {
            console.error("Call error", error)
            toast.error("Microphone access is required to start a call")
            get().cleanupCall()
        }
    },

    acceptCall: async () => {
        const { callUserId, pendingOffer } = get()
        const socket = useAuthStore.getState().socket
        if (!callUserId || !socket) return

        try {
            const localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const peerConnection = get().setupPeerConnection(callUserId)
            localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))

            set({ localStream, callState: "in-call", incomingCallFrom: null })
            socket.emit("call:accept", { toUserId: callUserId })

            if (pendingOffer?.offer) {
                await peerConnection.setRemoteDescription(pendingOffer.offer)
                const answer = await peerConnection.createAnswer()
                await peerConnection.setLocalDescription(answer)
                socket.emit("webrtc:answer", { toUserId: callUserId, answer })
                set({ pendingOffer: null })
            }
        } catch (error) {
            console.error("Accept call error", error)
            toast.error("Microphone access is required to accept a call")
            socket.emit("call:reject", { toUserId: callUserId })
            get().cleanupCall()
        }
    },

    rejectCall: () => {
        const { callUserId } = get()
        const socket = useAuthStore.getState().socket
        if (callUserId && socket) {
            socket.emit("call:reject", { toUserId: callUserId })
        }
        get().cleanupCall()
    },

    endCall: () => {
        const { callUserId } = get()
        const socket = useAuthStore.getState().socket
        if (callUserId && socket) {
            socket.emit("call:end", { toUserId: callUserId })
        }
        get().cleanupCall()
    },

    cleanupCall: () => {
        const { localStream, peerConnection } = get()
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop())
        }
        if (peerConnection) {
            peerConnection.onicecandidate = null
            peerConnection.ontrack = null
            peerConnection.close()
        }
        set({
            callState: "idle",
            callUserId: null,
            incomingCallFrom: null,
            localStream: null,
            remoteStream: null,
            peerConnection: null,
            pendingOffer: null
        })
    },

    setSelectedUser: (selectedUser) => set({ selectedUser })
}))
