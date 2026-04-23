import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { Image, Send, Sparkles, Wand2, X } from "lucide-react"

import { useChatStore } from "../store/useChatStore"

const REWRITE_TONES = [
  { id: "polite", label: "Polite" },
  { id: "shorter", label: "Shorter" },
  { id: "professional", label: "Professional" },
  { id: "funny", label: "Funny" }
]

const MessageInput = () => {
  const [text, setText] = useState("")
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState(null)
  const fileInputRef = useRef(null)
  const {
    sendMessage,
    updateMessage,
    editingMessage,
    setEditingMessage,
    smartReplies,
    fetchSmartReplies,
    clearSmartReplies,
    isGeneratingSmartReplies,
    rewriteMessageDraft,
    isRewritingMessage
  } = useChatStore()

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text || "")
      removeMedia()
    }
  }, [editingMessage])

  const handleMediaChange = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const isImage = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")

    if (!isImage && !isVideo) {
      toast.error("Please select an image or video file")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setMediaPreview(reader.result)
      setMediaType(isImage ? "image" : "video")
    }
    reader.readAsDataURL(file)
  }

  const removeMedia = () => {
    setMediaPreview(null)
    setMediaType(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const resetComposer = () => {
    setText("")
    removeMedia()
    setEditingMessage(null)
  }

  const handleSendMessage = async (event) => {
    event.preventDefault()
    if (!text.trim() && !mediaPreview) return

    try {
      if (editingMessage) {
        await updateMessage(editingMessage._id, text.trim())
      } else {
        const messageContent = { text: text.trim() }

        if (mediaPreview) {
          if (mediaType === "image") {
            messageContent.image = mediaPreview
          } else {
            messageContent.video = mediaPreview
          }
        }

        await sendMessage(messageContent)
      }

      resetComposer()
    } catch (error) {
      console.error("Failed to submit message:", error)
    }
  }

  const handleRewrite = async (tone) => {
    const rewrittenText = await rewriteMessageDraft(text, tone)
    setText(rewrittenText)
  }

  const handleUseSmartReply = (reply) => {
    setText(reply)
    clearSmartReplies()
  }

  return (
    <div className="p-4 w-full border-t border-base-300 bg-base-100">
      {editingMessage && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <span>Editing message</span>
          <button className="btn btn-ghost btn-xs" onClick={resetComposer} type="button">
            Cancel
          </button>
        </div>
      )}

      {mediaPreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            {mediaPreview.startsWith("data:video") ? (
              <video
                src={mediaPreview}
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
            ) : (
              <img
                src={mediaPreview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
            )}
            <button
              onClick={removeMedia}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {!editingMessage && smartReplies.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {smartReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              className="btn btn-xs btn-outline"
              onClick={() => handleUseSmartReply(reply)}
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {!editingMessage && (
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={fetchSmartReplies}
            disabled={isGeneratingSmartReplies}
          >
            <Sparkles className="size-3.5" />
            {isGeneratingSmartReplies ? "Thinking..." : "Smart Replies"}
          </button>
        )}

        {REWRITE_TONES.map((tone) => (
          <button
            key={tone.id}
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => handleRewrite(tone.id)}
            disabled={!text.trim() || isRewritingMessage}
          >
            <Wand2 className="size-3.5" />
            {tone.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {!editingMessage && (
            <>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleMediaChange}
              />
              <button
                type="button"
                className={`hidden sm:flex btn btn-circle ${mediaPreview ? "text-emerald-500" : "text-zinc-400"}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Image size={20} />
              </button>
            </>
          )}
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !mediaPreview}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  )
}

export default MessageInput
