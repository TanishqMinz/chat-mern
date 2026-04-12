import { Phone, X } from "lucide-react"
import { useAuthStore } from "../store/useAuthStore"
import { useChatStore } from "../store/useChatStore"

const ChatHeader = () => {
    const { selectedUser, setSelectedUser, startCall, callState } = useChatStore()
    const { onlineUsers } = useAuthStore()
    const isOnline = onlineUsers.includes(selectedUser._id)
    const canCall = callState === "idle" && isOnline
 
  return (
    <div className="p-2.5 border-b border-base-300">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                {/*Avatar */}
                <div className="avatar">
                    <div className="size-10 rounded-full relative">
                        <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                    </div>
                </div>

                {/* User Info */}
                <div>
                    <h3 className="font-medium">{selectedUser.fullName}</h3>
                    <p className="text-sm text-base-content/70">
                        {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
                    </p>
                </div>
            </div>

            {/* Close */}
            <div className="flex items-center gap-2">
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={startCall}
                    disabled={!canCall}
                    title={isOnline ? "Start voice call" : "User is offline"}
                >
                    <Phone className="size-4" />
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedUser(null)}>
                    <X className="size-4" />
                </button>
            </div>

        </div>
    </div>
  )
}

export default ChatHeader
