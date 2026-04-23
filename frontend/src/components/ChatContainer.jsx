import { useEffect, useRef, useState } from "react"
import { Ellipsis, Languages } from "lucide-react"

import { useChatStore } from "../store/useChatStore"
import ChatHeader from "./ChatHeader"
import MessageInput from "./MessageInput"
import MessageSkeleton from "./skeletons/MessageSkeleton"
import { useAuthStore } from "../store/useAuthStore"
import { formatMessageTime } from "../lib/utils"

const EDIT_WINDOW_MS = 15 * 60 * 1000
const LONG_PRESS_MS = 450

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    setEditingMessage,
    translateMessage,
    translationsByMessageId,
    translatingMessageId
  } = useChatStore()
  const { authUser } = useAuthStore()
  const messageEndRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const [actionMenuMessageId, setActionMenuMessageId] = useState(null)

  useEffect(() => {
    if (selectedUser?._id) {
      getMessages(selectedUser._id)
      subscribeToMessages()

      return () => unsubscribeFromMessages()
    }
  }, [selectedUser?._id, getMessages, subscribeToMessages, unsubscribeFromMessages])

  useEffect(() => {
    if (messageEndRef.current && messages.length > 0) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  useEffect(() => {
    const closeMenu = () => setActionMenuMessageId(null)
    window.addEventListener("click", closeMenu)

    return () => {
      window.removeEventListener("click", closeMenu)
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  const startLongPress = (messageId) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
    }

    longPressTimerRef.current = window.setTimeout(() => {
      setActionMenuMessageId(messageId)
    }, LONG_PRESS_MS)
  }

  const stopLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleTranslate = async (message) => {
    await translateMessage(message._id, message.text, "English")
    setActionMenuMessageId(null)
  }

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto relative">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto relative">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isOwnMessage = message.senderId === authUser._id
          const isEditable =
            isOwnMessage &&
            !message.image &&
            !message.video &&
            Date.now() - new Date(message.createdAt).getTime() <= EDIT_WINDOW_MS
          const canTranslate = !isOwnMessage && Boolean(message.text?.trim())
          const translation = translationsByMessageId[message._id]
          const isActionMenuOpen = actionMenuMessageId === message._id

          return (
            <div
              key={message._id}
              className={`chat ${isOwnMessage ? "chat-end" : "chat-start"}`}
              ref={messageEndRef}
              onTouchStart={() => startLongPress(message._id)}
              onTouchEnd={stopLongPress}
              onTouchMove={stopLongPress}
            >
              <div className="chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img
                    src={
                      isOwnMessage
                        ? authUser.profilePic || "avatar.png"
                        : selectedUser.profilePic || "avatar.png"
                    }
                    alt="profile picture"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="chat-header mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <time className="text-xs opacity-50 ml-1">
                      {formatMessageTime(message.createdAt)}
                    </time>
                    {message.editedAt && (
                      <span className="text-[11px] uppercase tracking-wide text-base-content/50">
                        edited
                      </span>
                    )}
                  </div>

                  {(isEditable || canTranslate) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={(event) => {
                        event.stopPropagation()
                        setActionMenuMessageId(isActionMenuOpen ? null : message._id)
                      }}
                    >
                      <Ellipsis className="size-3.5" />
                    </button>
                  )}
                </div>

                {isActionMenuOpen && (
                  <div
                    className={`absolute z-10 mt-1 w-40 rounded-lg border border-base-300 bg-base-100 shadow-lg ${
                      isOwnMessage ? "right-0" : "left-0"
                    }`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {isEditable && (
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-base-200"
                        onClick={() => {
                          setEditingMessage(message)
                          setActionMenuMessageId(null)
                        }}
                      >
                        Edit Message
                      </button>
                    )}
                    {canTranslate && (
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-base-200"
                        onClick={() => handleTranslate(message)}
                      >
                        Translate
                      </button>
                    )}
                  </div>
                )}

                <div className="chat-bubble flex flex-col">
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Attachment"
                      className="sm:max-w-[200px] rounded-md mb-2"
                    />
                  )}
                  {message.video && (
                    <video
                      src={message.video}
                      controls
                      className="sm:max-w-[200px] rounded-md mb-2"
                    />
                  )}
                  {message.text && <p>{message.text}</p>}

                  {translatingMessageId === message._id && (
                    <div className="mt-2 text-xs opacity-70 flex items-center gap-2">
                      <Languages className="size-3.5" />
                      Translating...
                    </div>
                  )}

                  {translation && (
                    <div className="mt-3 rounded-md border border-base-300/80 bg-base-100/60 px-3 py-2 text-sm text-base-content/80">
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-base-content/50">
                        Translation to {translation.targetLanguage}
                      </div>
                      <p>{translation.text}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <MessageInput />
    </div>
  )
}

export default ChatContainer
