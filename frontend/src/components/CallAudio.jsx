import { useEffect, useRef } from "react"
import { useCallStore } from "../store/useCallStore"

const CallAudio = () => {
  const { remoteStream } = useCallStore()
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
