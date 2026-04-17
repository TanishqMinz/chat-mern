import { create } from "zustand"
import { toast } from "react-hot-toast"

import { CALL_TIMEOUT_MS, getIceServers, getMediaErrorMessage } from "../lib/callConfig"
import { useAuthStore } from "./useAuthStore"

let callTimeoutId = null

const clearCallTimeout = () => {
  if (callTimeoutId) {
    window.clearTimeout(callTimeoutId)
    callTimeoutId = null
  }
}

const flushPendingIceCandidates = async () => {
  const { peerConnection, pendingIceCandidates } = useCallStore.getState()
  if (!peerConnection || !peerConnection.remoteDescription) return

  for (const candidate of pendingIceCandidates) {
    try {
      await peerConnection.addIceCandidate(candidate)
    } catch (error) {
      console.error("ICE candidate flush error", error)
    }
  }

  useCallStore.setState({ pendingIceCandidates: [] })
}

const scheduleCallTimeout = () => {
  clearCallTimeout()

  callTimeoutId = window.setTimeout(() => {
    const { callState, callUserId } = useCallStore.getState()
    const socket = useAuthStore.getState().socket

    if (callState !== "calling" || !callUserId || !socket) return

    socket.emit("call:end", { toUserId: callUserId })
    useCallStore.getState().cleanupCall()
    toast.error("Call timed out")
  }, CALL_TIMEOUT_MS)
}

const getMediaStream = async (callType) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("MediaDevicesUnavailable")
  }

  const wantsVideo = callType === "video"

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: wantsVideo
      ? {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      : false
  })
}

const getCallFailureMessage = (error) => (
  error.message === "MediaDevicesUnavailable"
    ? "Camera and microphone APIs are not supported in this browser"
    : getMediaErrorMessage(error)
)

export const useCallStore = create((set, get) => ({
  callState: "idle",
  callType: "audio",
  callUserId: null,
  incomingCallFrom: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  pendingOffer: null,
  pendingIceCandidates: [],
  isMuted: false,
  isVideoEnabled: true,
  isOverlayMinimized: false,
  connectionState: "idle",

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
    socket.off("disconnect")

    socket.on("call:request", ({ fromUserId, callType = "audio" }) => {
      const { callState } = get()
      if (callState !== "idle") {
        socket.emit("call:reject", { toUserId: fromUserId, reason: "busy" })
        return
      }

      set({
        callState: "incoming",
        callType,
        incomingCallFrom: fromUserId,
        callUserId: fromUserId,
        isOverlayMinimized: false,
        connectionState: "ringing"
      })
    })

    socket.on("call:accept", async ({ fromUserId, callType = "audio" }) => {
      const { callState, callUserId, peerConnection, localStream } = get()
      if (callState !== "calling" || callUserId !== fromUserId || !peerConnection || !localStream) return

      clearCallTimeout()

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      socket.emit("webrtc:offer", { toUserId: fromUserId, offer })
      set({ callState: "in-call", callType, connectionState: "connecting" })
    })

    socket.on("call:reject", ({ fromUserId, reason }) => {
      if (get().callUserId !== fromUserId) return

      get().cleanupCall()
      toast.error(reason === "busy" ? "User is already on another call" : "Call rejected")
    })

    socket.on("call:end", ({ fromUserId }) => {
      const { callUserId, callState } = get()
      if (callUserId !== fromUserId && callState !== "calling") return

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
      await flushPendingIceCandidates()

      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      socket.emit("webrtc:answer", { toUserId: fromUserId, answer })
      set({ connectionState: "connecting" })
    })

    socket.on("webrtc:answer", async ({ fromUserId, answer }) => {
      const { peerConnection, callUserId } = get()
      if (!peerConnection || callUserId !== fromUserId) return

      await peerConnection.setRemoteDescription(answer)
      await flushPendingIceCandidates()
      set({ connectionState: "connecting" })
    })

    socket.on("webrtc:ice-candidate", async ({ fromUserId, candidate }) => {
      const { peerConnection, callUserId, pendingIceCandidates } = get()
      if (!peerConnection || callUserId !== fromUserId) return

      if (!peerConnection.remoteDescription) {
        set({ pendingIceCandidates: [...pendingIceCandidates, candidate] })
        return
      }

      try {
        await peerConnection.addIceCandidate(candidate)
      } catch (error) {
        console.error("ICE candidate error", error)
      }
    })

    socket.on("disconnect", () => {
      if (get().callState !== "idle") {
        get().cleanupCall()
        toast.error("Connection lost. Call ended.")
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
    socket.off("disconnect")
  },

  setupPeerConnection: (remoteUserId) => {
    const socket = useAuthStore.getState().socket
    const peerConnection = new RTCPeerConnection({
      iceServers: getIceServers()
    })

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit("webrtc:ice-candidate", { toUserId: remoteUserId, candidate: event.candidate })
      }
    }

    peerConnection.ontrack = (event) => {
      set({ remoteStream: event.streams[0] })
    }

    peerConnection.onconnectionstatechange = () => {
      const nextState = peerConnection.connectionState
      set({ connectionState: nextState })

      if (nextState === "failed" || nextState === "disconnected" || nextState === "closed") {
        if (get().callState !== "idle") {
          get().cleanupCall()
          toast.error("Call connection was interrupted")
        }
      }
    }

    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState
      if (iceState === "connected" || iceState === "completed") {
        set({ connectionState: "connected" })
      }
    }

    set({ peerConnection, pendingIceCandidates: [], connectionState: "connecting" })
    return peerConnection
  },

  startCall: async (selectedUserId, callType = "audio") => {
    const socket = useAuthStore.getState().socket
    const onlineUsers = useAuthStore.getState().onlineUsers

    if (!selectedUserId || !socket) return
    if (get().callState !== "idle") return
    if (!onlineUsers.includes(selectedUserId)) {
      toast.error("User is offline")
      return
    }

    try {
      const localStream = await getMediaStream(callType)
      const peerConnection = get().setupPeerConnection(selectedUserId)
      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))

      set({
        localStream,
        callState: "calling",
        callType,
        callUserId: selectedUserId,
        incomingCallFrom: null,
        isMuted: false,
        isVideoEnabled: callType === "video",
        isOverlayMinimized: false,
        connectionState: "ringing"
      })

      scheduleCallTimeout()
      socket.emit("call:request", { toUserId: selectedUserId, callType })
    } catch (error) {
      console.error("Call error", error)
      toast.error(getCallFailureMessage(error))
      get().cleanupCall()
    }
  },

  acceptCall: async () => {
    const { callUserId, pendingOffer, callType } = get()
    const socket = useAuthStore.getState().socket
    if (!callUserId || !socket) return

    try {
      const localStream = await getMediaStream(callType)
      const peerConnection = get().setupPeerConnection(callUserId)
      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))

      set({
        localStream,
        callState: "in-call",
        incomingCallFrom: null,
        isMuted: false,
        isVideoEnabled: callType === "video",
        isOverlayMinimized: false,
        connectionState: "connecting"
      })

      socket.emit("call:accept", { toUserId: callUserId, callType })

      if (pendingOffer?.offer) {
        await peerConnection.setRemoteDescription(pendingOffer.offer)
        await flushPendingIceCandidates()

        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
        socket.emit("webrtc:answer", { toUserId: callUserId, answer })
        set({ pendingOffer: null })
      }
    } catch (error) {
      console.error("Accept call error", error)
      toast.error(getCallFailureMessage(error))
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

  handleCallPageLeave: () => {
    const { callState, callUserId } = get()
    const socket = useAuthStore.getState().socket

    if (callState === "idle" || !callUserId || !socket) return

    socket.emit("call:end", { toUserId: callUserId })
    get().cleanupCall()
  },

  toggleMute: () => {
    const { localStream, isMuted } = get()
    if (!localStream) return

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = isMuted
    })

    set({ isMuted: !isMuted })
  },

  toggleVideo: () => {
    const { localStream, callType } = get()
    if (!localStream || callType !== "video") return

    const videoTracks = localStream.getVideoTracks()
    if (videoTracks.length === 0) return

    const nextEnabled = !videoTracks[0].enabled
    videoTracks.forEach((track) => {
      track.enabled = nextEnabled
    })

    set({ isVideoEnabled: nextEnabled })
  },

  toggleOverlayMinimized: () => {
    set({ isOverlayMinimized: !get().isOverlayMinimized })
  },

  cleanupCall: () => {
    const { localStream, peerConnection } = get()

    clearCallTimeout()

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }

    if (peerConnection) {
      peerConnection.onicecandidate = null
      peerConnection.ontrack = null
      peerConnection.onconnectionstatechange = null
      peerConnection.oniceconnectionstatechange = null
      peerConnection.close()
    }

    set({
      callState: "idle",
      callType: "audio",
      callUserId: null,
      incomingCallFrom: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      pendingOffer: null,
      pendingIceCandidates: [],
      isMuted: false,
      isVideoEnabled: true,
      isOverlayMinimized: false,
      connectionState: "idle"
    })
  }
}))
