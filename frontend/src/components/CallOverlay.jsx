import { Camera, CameraOff, Maximize2, MicOff, Minimize2, Phone, PhoneOff, Volume2 } from "lucide-react"

import { useChatStore } from "../store/useChatStore"
import { useCallStore } from "../store/useCallStore"
import { useAuthStore } from "../store/useAuthStore"
import AudioLevelMeter from "./AudioLevelMeter"
import CallAudio from "./CallAudio"
import StreamVideo from "./StreamVideo"

const CallOverlay = () => {
  const { users, selectedUser } = useChatStore()
  const { authUser } = useAuthStore()
  const {
    callState,
    callType,
    incomingCallFrom,
    callUserId,
    isMuted,
    isVideoEnabled,
    isOverlayMinimized,
    remoteStream,
    localStream,
    connectionState,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleOverlayMinimized
  } = useCallStore()

  if (callState === "idle") return null

  const incomingUser =
    users.find((user) => user._id === incomingCallFrom) || selectedUser
  const activeUser =
    users.find((user) => user._id === callUserId) || selectedUser
  const isIncoming = callState === "incoming"
  const isVideoCall = callType === "video"
  const remoteHasVideo = Boolean(remoteStream?.getVideoTracks?.().length)
  const localHasVideo = Boolean(localStream?.getVideoTracks?.().length)
  const showIncomingModal = isIncoming
  const showCompactPanel = !isIncoming
  const shouldShowLargeStage = isVideoCall && !isOverlayMinimized

  const statusText =
    connectionState === "connected"
      ? isVideoCall ? "Video connected" : "Audio connected"
      : connectionState === "connecting"
        ? isVideoCall ? "Connecting video..." : "Connecting audio..."
        : callState === "calling"
          ? isVideoCall ? "Ringing for video..." : "Ringing..."
          : isIncoming
            ? `Incoming ${callType} call`
            : isVideoCall
              ? "Video call active"
              : "Voice call active"

  return (
    <div className={`absolute inset-x-0 bottom-0 top-16 z-30 ${showIncomingModal ? "bg-base-300/70 backdrop-blur-sm p-3 sm:p-6" : "pointer-events-none p-3 sm:p-4"}`}>
      <div
        className={[
          "relative overflow-hidden border border-base-300 bg-base-100 shadow-2xl pointer-events-auto",
          showIncomingModal
            ? "flex h-full w-full flex-col rounded-2xl"
            : "ml-auto flex w-full max-w-sm flex-col rounded-2xl",
          showCompactPanel
            ? "mt-auto max-h-[calc(100vh-7rem)]"
            : ""
        ].join(" ")}
      >
        <CallAudio />

        <div className="flex items-center justify-between border-b border-base-300 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="avatar">
              <div className="size-11 rounded-full ring ring-base-300 ring-offset-2 ring-offset-base-100">
                <img
                  src={activeUser?.profilePic || "/avatar.png"}
                  alt={activeUser?.fullName || "User"}
                />
              </div>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{activeUser?.fullName || "User"}</p>
              <p className="text-sm text-base-content/70">{statusText}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!isIncoming && localStream && <AudioLevelMeter stream={localStream} label="Mic" />}
            {callState === "in-call" && remoteStream && <AudioLevelMeter stream={remoteStream} label="Audio" />}
            {!isIncoming && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={toggleOverlayMinimized}
                title={isOverlayMinimized ? "Expand call panel" : "Minimize call panel"}
              >
                {isOverlayMinimized ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
              </button>
            )}
          </div>
        </div>

        {!isOverlayMinimized && (
          <div className={`relative overflow-hidden bg-base-200 ${showIncomingModal ? "flex-1" : shouldShowLargeStage ? "h-72 sm:h-80" : "h-auto"}`}>
            {isVideoCall ? (
            <>
              {remoteHasVideo ? (
                <StreamVideo
                  stream={remoteStream}
                  muted
                  className="h-full w-full object-cover bg-neutral"
                  poster={activeUser?.profilePic || "/avatar.png"}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-base-200 via-base-300 to-base-200 px-6">
                  <div className="text-center">
                    <div className="avatar mb-4">
                      <div className="size-24 rounded-full ring ring-base-300 ring-offset-4 ring-offset-base-200">
                        <img
                          src={activeUser?.profilePic || "/avatar.png"}
                          alt={activeUser?.fullName || "User"}
                        />
                      </div>
                    </div>
                    <p className="text-xl font-semibold">{activeUser?.fullName || "User"}</p>
                    <p className="mt-2 text-sm text-base-content/70">
                      {connectionState === "connected" ? "Waiting for camera feed..." : statusText}
                    </p>
                  </div>
                </div>
              )}

              {localHasVideo && (
                <div className="absolute bottom-4 right-4 h-32 w-24 overflow-hidden rounded-xl border border-base-300 bg-neutral shadow-lg sm:h-40 sm:w-32">
                  <StreamVideo
                    stream={localStream}
                    muted
                    className={`h-full w-full object-cover ${isVideoEnabled ? "" : "opacity-50"}`}
                    poster={authUser?.profilePic || selectedUser?.profilePic || "/avatar.png"}
                  />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-base-100/70 text-xs font-medium">
                      Camera Off
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className={`flex items-center justify-center bg-gradient-to-br from-base-100 via-base-200 to-base-300 px-6 ${showIncomingModal ? "h-full" : "py-10"}`}>
              <div className="text-center">
                <div className="avatar mb-4">
                  <div className="size-28 rounded-full ring ring-base-300 ring-offset-4 ring-offset-base-100">
                    <img
                      src={activeUser?.profilePic || "/avatar.png"}
                      alt={activeUser?.fullName || "User"}
                    />
                  </div>
                </div>
                <p className="text-2xl font-semibold">{activeUser?.fullName || "User"}</p>
                <p className="mt-2 text-base-content/70">{statusText}</p>
              </div>
            </div>
            )}
          </div>
        )}

        <div className="border-t border-base-300 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isIncoming ? (
              <>
                <button className="btn btn-success" onClick={acceptCall}>
                  <Phone className="size-4" />
                  Accept
                </button>
                <button className="btn btn-error" onClick={rejectCall}>
                  <PhoneOff className="size-4" />
                  Reject
                </button>
              </>
            ) : (
              <>
                <button
                  className={`btn ${isMuted ? "btn-warning" : "btn-ghost"}`}
                  onClick={toggleMute}
                  title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {isMuted ? <MicOff className="size-4" /> : <Volume2 className="size-4" />}
                  {isMuted ? "Muted" : "Mute"}
                </button>
                {isVideoCall && (
                  <button
                    className={`btn ${isVideoEnabled ? "btn-ghost" : "btn-warning"}`}
                    onClick={toggleVideo}
                    title={isVideoEnabled ? "Turn camera off" : "Turn camera on"}
                  >
                    {isVideoEnabled ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
                    {isVideoEnabled ? "Camera" : "Camera Off"}
                  </button>
                )}
                <button className="btn btn-error" onClick={endCall}>
                  <PhoneOff className="size-4" />
                  End Call
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallOverlay
