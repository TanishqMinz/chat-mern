import { useEffect, useRef } from "react"

const StreamVideo = ({ stream, muted = false, className = "", poster = "/avatar.png" }) => {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null
    }
  }, [stream])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      poster={poster}
      className={className}
    />
  )
}

export default StreamVideo
