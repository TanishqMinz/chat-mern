const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" }
]

export const CALL_TIMEOUT_MS = Number(import.meta.env.VITE_CALL_TIMEOUT_MS || 30000)

export const getIceServers = () => {
  const configuredIceServers = import.meta.env.VITE_ICE_SERVERS

  if (configuredIceServers) {
    try {
      const parsedServers = JSON.parse(configuredIceServers)
      if (Array.isArray(parsedServers) && parsedServers.length > 0) {
        return parsedServers
      }
    } catch (error) {
      console.error("Invalid VITE_ICE_SERVERS value", error)
    }
  }

  const turnUrl = import.meta.env.VITE_TURN_URL
  const turnUsername = import.meta.env.VITE_TURN_USERNAME
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL

  if (turnUrl && turnUsername && turnCredential) {
    return [
      ...DEFAULT_ICE_SERVERS,
      {
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential
      }
    ]
  }

  return DEFAULT_ICE_SERVERS
}

export const getMediaErrorMessage = (error) => {
  const name = error?.name || "UnknownError"
  const detail = error?.message ? ` (${error.message})` : ""
  return `Microphone error: ${name}${detail}`
}
