import { Phone, PhoneOff } from "lucide-react"
import { useChatStore } from "../store/useChatStore"

const CallOverlay = () => {
  const {
    callState,
    incomingCallFrom,
    callUserId,
    users,
    selectedUser,
    acceptCall,
    rejectCall,
    endCall
  } = useChatStore()

  if (callState === "idle") return null

  const incomingUser =
    users.find((user) => user._id === incomingCallFrom) || selectedUser
  const activeUser =
    users.find((user) => user._id === callUserId) || selectedUser

  return (
    <div className="absolute inset-x-0 top-0 z-20 p-3">
      <div className="bg-base-100 border border-base-300 rounded-lg shadow-md px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="size-10 rounded-full">
              <img
                src={activeUser?.profilePic || "/avatar.png"}
                alt={activeUser?.fullName || "User"}
              />
            </div>
          </div>
          <div>
            <p className="font-medium">
              {callState === "incoming" &&
                `Incoming call from ${incomingUser?.fullName || "User"}`}
              {callState === "calling" &&
                `Calling ${activeUser?.fullName || "User"}`}
              {callState === "in-call" &&
                `In call with ${activeUser?.fullName || "User"}`}
            </p>
            <p className="text-xs text-base-content/70">
              {callState === "calling" && "Calling..."}
              {callState === "incoming" && "Tap to accept"}
              {callState === "in-call" && "Voice call active"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {callState === "incoming" && (
            <>
              <button
                className="btn btn-sm btn-success"
                onClick={acceptCall}
              >
                <Phone className="size-4" />
                Accept
              </button>
              <button
                className="btn btn-sm btn-error"
                onClick={rejectCall}
              >
                <PhoneOff className="size-4" />
                Reject
              </button>
            </>
          )}

          {callState !== "incoming" && (
            <button className="btn btn-sm btn-error" onClick={endCall}>
              <PhoneOff className="size-4" />
              End
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CallOverlay
