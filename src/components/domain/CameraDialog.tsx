import { useEffect, useRef, useState } from 'react'
import { Camera, ImageUp, RotateCcw, SwitchCamera } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { CAMERA_UNSUPPORTED, cameraErrorMessage, cameraSupported, openCamera, stopCamera, videoFrameToSmallDataUrl, type CameraFacing } from '@/lib/camera'

type Phase = { kind: 'starting' } | { kind: 'live' } | { kind: 'shot'; dataUrl: string } | { kind: 'error'; message: string }

/**
 * Take a member photo with the device camera. The picture is cropped to a square, shrunk and handed
 * back as a data URL; it is stored with the member in this browser and never uploaded.
 * Rendered only while open, so the camera is released as soon as the dialog goes away.
 */
export function CameraDialog({ onClose, onCapture, onUploadInstead }: { onClose: () => void; onCapture: (dataUrl: string) => void; onUploadInstead: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const shutterRef = useRef<HTMLButtonElement>(null)
  // The back camera suits a phone held at the desk; a laptop simply opens the webcam it has.
  const [facing, setFacing] = useState<CameraFacing>('environment')
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<Phase>(() => (cameraSupported() ? { kind: 'starting' } : { kind: 'error', message: CAMERA_UNSUPPORTED }))
  const [mirrored, setMirrored] = useState(false)
  const [canSwitch, setCanSwitch] = useState(false)

  useEffect(() => {
    if (!cameraSupported()) return
    let cancelled = false
    const start = async () => {
      try {
        const stream = await openCamera(facing)
        if (cancelled) {
          stopCamera(stream)
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        if (cancelled) return
        // Only a camera that reports it faces away is shown as-is; webcams and front cameras read better mirrored.
        setMirrored(stream.getVideoTracks()[0]?.getSettings().facingMode !== 'environment')
        setPhase({ kind: 'live' })
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        if (!cancelled) setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1)
      } catch (err) {
        if (!cancelled) setPhase({ kind: 'error', message: cameraErrorMessage(err) })
      }
    }
    void start()
    return () => {
      cancelled = true
      stopCamera(streamRef.current)
      streamRef.current = null
    }
  }, [facing, attempt])

  const live = phase.kind === 'live'
  useEffect(() => {
    if (live) shutterRef.current?.focus()
  }, [live])

  const restart = (next: CameraFacing = facing) => {
    setPhase({ kind: 'starting' })
    setFacing(next)
    setAttempt((n) => n + 1)
  }

  const takePhoto = () => {
    const video = videoRef.current
    if (!video) return
    try {
      setPhase({ kind: 'shot', dataUrl: videoFrameToSmallDataUrl(video) })
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'Could not take the photo.' })
    }
  }

  const retake = () => {
    void videoRef.current?.play().catch(() => undefined)
    setPhase({ kind: 'live' })
  }

  const footer =
    phase.kind === 'shot' ? (
      <>
        <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" aria-hidden />} onClick={retake}>Retake</Button>
        <Button data-primary onClick={() => { onCapture(phase.dataUrl); onClose() }}>Use photo</Button>
      </>
    ) : phase.kind === 'error' ? (
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" icon={<ImageUp className="h-4 w-4" aria-hidden />} onClick={() => { onClose(); onUploadInstead() }}>Upload a photo instead</Button>
        {cameraSupported() ? <Button data-primary onClick={() => restart()}>Try again</Button> : null}
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        {canSwitch ? <Button variant="secondary" icon={<SwitchCamera className="h-4 w-4" aria-hidden />} disabled={!live} onClick={() => restart(facing === 'environment' ? 'user' : 'environment')}>Switch camera</Button> : null}
        <Button ref={shutterRef} data-primary icon={<Camera className="h-4 w-4" aria-hidden />} disabled={!live} onClick={takePhoto}>Take photo</Button>
      </>
    )

  return (
    <Modal open onClose={onClose} title="Take photo" description="The photo is saved with the member in this browser. It is not uploaded anywhere." footer={footer}>
      <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl bg-sunken">
        {/* The video stays mounted through every phase so the stream keeps its element. */}
        <video ref={videoRef} playsInline muted aria-label="Camera preview" className={cn('h-full w-full object-cover', mirrored && '-scale-x-100', !live && 'invisible')} />
        {phase.kind === 'starting' ? (
          <div className="absolute inset-0 flex items-center justify-center"><Spinner label="Starting the camera…" /></div>
        ) : null}
        {phase.kind === 'shot' ? <img src={phase.dataUrl} alt="Photo just taken" className="absolute inset-0 h-full w-full object-cover" /> : null}
        {phase.kind === 'error' ? (
          <div className="absolute inset-0 flex items-center justify-center p-5 text-center">
            <p role="alert" className="text-sm text-muted">{phase.message}</p>
          </div>
        ) : null}
      </div>
      {live ? <p className="mt-3 text-center text-sm text-muted">Keep the face inside the square. You can retake it before saving.</p> : null}
    </Modal>
  )
}
