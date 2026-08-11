'use client'

import { useEffect, useRef, useState } from 'react'
import { getApiUrl } from '@/config/api'

interface WebcamMonitorProps {
  examId: number
  attemptId: number
  token: string
  isActive: boolean
}

export default function WebcamMonitor({ examId, attemptId, token, isActive }: WebcamMonitorProps) {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [captureCount, setCaptureCount] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const captureIntervalRef = useRef<NodeJS.Timeout>()

  const requestCameraPermission = async () => {
    if (!isActive) return

    try {
      setPermissionStatus('requesting')
      setError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      setPermissionStatus('granted')
      setIsMonitoring(true)

      // Start periodic captures
      startPeriodicCapture()

    } catch (err: any) {
      console.error('Camera access error:', err)
      setError(err.message || 'Failed to access camera')
      setPermissionStatus('denied')
      setIsMonitoring(false)
    }
  }

  const startPeriodicCapture = () => {
    // Capture images every 60 seconds
    captureIntervalRef.current = setInterval(() => {
      if (isActive && permissionStatus === 'granted') {
        captureAndUpload()
      }
    }, 60000)

    // Capture first image immediately
    setTimeout(captureAndUpload, 2000)
  }

  const captureAndUpload = async () => {
    if (!videoRef.current || !canvasRef.current || !isActive) return

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) return

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480

      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          await uploadWebcamImage(blob)
          setCaptureCount(prev => prev + 1)
        }
      }, 'image/jpeg', 0.8)

    } catch (error) {
      console.error('Capture error:', error)
    }
  }

  const uploadWebcamImage = async (blob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('image', blob, `webcam-${attemptId}-${Date.now()}.jpg`)
      formData.append('exam_id', examId.toString())
      formData.append('attempt_id', attemptId.toString())
      formData.append('timestamp', Date.now().toString())

      const response = await fetch(`${getApiUrl()}/results/${attemptId}/upload-webcam-image/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload webcam image')
      }

      console.log('Webcam image uploaded successfully')
    } catch (error) {
      console.error('Webcam upload error:', error)
    }
  }

  const stopMonitoring = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
    }

    setIsMonitoring(false)
    setPermissionStatus('idle')
  }

  useEffect(() => {
    if (isActive && permissionStatus === 'idle') {
      // Auto-request camera permission when exam starts
      setTimeout(() => {
        requestCameraPermission()
      }, 3000) // Small delay to ensure exam is fully loaded
    }

    return () => {
      stopMonitoring()
    }
  }, [isActive])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isMonitoring) {
        // Pause monitoring when tab is hidden
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current)
        }
      } else if (!document.hidden && isMonitoring) {
        // Resume monitoring when tab is visible
        startPeriodicCapture()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isMonitoring])

  // Don't render visible UI elements - this runs in background
  // But keep video and canvas elements for capturing
  return (
    <>
      {/* Hidden video element for camera stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px'
        }}
      />
      
      {/* Hidden canvas for image capture */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px'
        }}
      />
    </>
  )
}
