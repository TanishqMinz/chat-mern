import { useEffect, useRef } from "react"
import { useChatStore } from "../store/useChatStore"

const CallAudio = () => {
  const { remoteStream } = useChatStore()
  const audioRef = useRef(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = remoteStream || null
    }
  }, [remoteStream])

  if (!remoteStream) return null

  return <audio ref={audioRef} autoPlay playsInline />
}

export default CallAudio
