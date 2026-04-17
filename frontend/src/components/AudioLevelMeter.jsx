import { useEffect, useRef, useState } from "react"

const AudioLevelMeter = ({ stream, label = "Mic" }) => {
  const [level, setLevel] = useState(0)
  const rafRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const ctxRef = useRef(null)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      return
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyserRef.current = analyser

    const source = ctx.createMediaStreamSource(stream)
    sourceRef.current = source
    source.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      const normalized = Math.min(1, rms * 2.5)
      setLevel(normalized)
      rafRef.current = requestAnimationFrame(tick)
    }

    ctx.resume().catch(() => {})
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (sourceRef.current) sourceRef.current.disconnect()
      if (analyserRef.current) analyserRef.current.disconnect()
      if (ctxRef.current && ctxRef.current.state !== "closed") ctxRef.current.close()
    }
  }, [stream])

  const percent = Math.round(level * 100)
  const color =
    percent > 70 ? "bg-error" : percent > 35 ? "bg-warning" : "bg-success"

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-base-content/60">{label}</span>
      <div className="w-28 h-2 rounded-full bg-base-200 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-75`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default AudioLevelMeter
