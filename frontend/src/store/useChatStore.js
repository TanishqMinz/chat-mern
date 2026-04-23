import { create } from "zustand"
import { toast } from "react-hot-toast"

import { axiosInstance } from "../lib/axios"
import { useAuthStore } from "./useAuthStore"

const SMART_REPLY_LIMIT = 8

const replaceMessage = (messages, updatedMessage) =>
  messages.map((message) => (message._id === updatedMessage._id ? updatedMessage : message))

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  editingMessage: null,
  smartReplies: [],
  translationsByMessageId: {},
  translatingMessageId: null,
  isGeneratingSmartReplies: false,
  isRewritingMessage: false,

  getUsers: async () => {
    set({ isUsersLoading: true })
    try {
      const res = await axiosInstance.get("/messages/users")
      set({ users: res.data })
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load users")
    } finally {
      set({ isUsersLoading: false })
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true, smartReplies: [] })
    try {
      const res = await axiosInstance.get(`/messages/${userId}`)
      set({ messages: res.data })
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load messages")
    } finally {
      set({ isMessagesLoading: false })
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get()
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData)
      set({ messages: [...messages, res.data], smartReplies: [] })
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message")
      throw error
    }
  },

  updateMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.patch(`/messages/${messageId}`, { text })
      set({
        messages: replaceMessage(get().messages, res.data),
        editingMessage: null
      })
      toast.success("Message updated")
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update message")
      throw error
    }
  },

  fetchSmartReplies: async () => {
    const { messages } = get()
    if (messages.length === 0) return

    set({ isGeneratingSmartReplies: true })

    try {
      const conversation = messages.slice(-SMART_REPLY_LIMIT).map((message) => ({
        role: message.senderId === useAuthStore.getState().authUser?._id ? "assistant" : "user",
        content: message.text || (message.image ? "[Image]" : message.video ? "[Video]" : "")
      }))

      const res = await axiosInstance.post("/ai/smart-replies", { messages: conversation })
      set({ smartReplies: res.data.replies || [] })
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to generate smart replies")
    } finally {
      set({ isGeneratingSmartReplies: false })
    }
  },

  rewriteMessageDraft: async (text, tone) => {
    if (!text.trim()) return text

    set({ isRewritingMessage: true })

    try {
      const res = await axiosInstance.post("/ai/rewrite", { text, tone })
      return res.data.text || text
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to rewrite message")
      return text
    } finally {
      set({ isRewritingMessage: false })
    }
  },

  translateMessage: async (messageId, text, targetLanguage = "English") => {
    const cachedTranslation = get().translationsByMessageId[messageId]
    if (cachedTranslation?.targetLanguage === targetLanguage) {
      return cachedTranslation
    }

    set({ translatingMessageId: messageId })

    try {
      const res = await axiosInstance.post("/ai/translate", { text, targetLanguage })
      const translation = {
        text: res.data.text || text,
        sourceLanguage: res.data.sourceLanguage || "",
        targetLanguage: res.data.targetLanguage || targetLanguage
      }

      set({
        translationsByMessageId: {
          ...get().translationsByMessageId,
          [messageId]: translation
        }
      })

      return translation
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to translate message")
      return null
    } finally {
      set({ translatingMessageId: null })
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get()
    if (!selectedUser) return

    const socket = useAuthStore.getState().socket
    if (!socket) return

    socket.on("newMessage", (newMessage) => {
      const isMessageRelevant =
        newMessage.senderId === selectedUser._id || newMessage.receiverId === selectedUser._id

      if (!isMessageRelevant) return

      set({
        messages: [...get().messages, newMessage],
        smartReplies: []
      })
    })

    socket.on("messageUpdated", (updatedMessage) => {
      const isMessageRelevant =
        updatedMessage.senderId === selectedUser._id ||
        updatedMessage.receiverId === selectedUser._id ||
        updatedMessage.senderId === useAuthStore.getState().authUser?._id

      if (!isMessageRelevant) return

      set({
        messages: replaceMessage(get().messages, updatedMessage)
      })
    })
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket
    socket?.off("newMessage")
    socket?.off("messageUpdated")
  },

  setSelectedUser: (selectedUser) =>
    set({
      selectedUser,
      smartReplies: [],
      editingMessage: null,
      translationsByMessageId: {}
    }),
  setEditingMessage: (editingMessage) => set({ editingMessage }),
  clearSmartReplies: () => set({ smartReplies: [] })
}))
