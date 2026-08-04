'use client'

import { useEffect, useRef, useState } from 'react'

interface ScreenRecorderProps {
  examId: number
  attemptId: number
  token: string
  isActive: boolean
}

export default function ScreenRecorder({ examId, attemptId, token, isActive }: ScreenRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'requesting' | 'recording' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const uploadIntervalRef = useRef<NodeJS.Timeout>()

  const startRecording = async () => {
    if (!isActive) return

    try {
      setRecordingStatus('requesting')
      setError(null)

      // Request screen recording permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      })

      streamRef.current = stream

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        await uploadRecording(blob)
        chunksRef.current = []
      }

      // Start recording
      mediaRecorder.start(10000) // Capture in 10-second chunks
      setIsRecording(true)
      setRecordingStatus('recording')

      // Set up periodic uploads
      uploadIntervalRef.current = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
          setTimeout(() => {
            if (isActive && mediaRecorderRef.current) {
              mediaRecorderRef.current.start(10000)
            }
          }, 1000)
        }
      }, 30000) // Upload every 30 seconds

      // Handle user stopping recording
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording()
      })

    } catch (err: any) {
      console.error('Screen recording error:', err)
      setError(err.message || 'Failed to start screen recording')
      setRecordingStatus('error')
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current)
    }

    setIsRecording(false)
    setRecordingStatus('idle')
  }

  const uploadRecording = async (blob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('video', blob, `screen-recording-${attemptId}-${Date.now()}.webm`)
      formData.append('exam_id', examId.toString())
      formData.append('attempt_id', attemptId.toString())
      formData.append('timestamp', Date.now().toString())

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/results/${attemptId}/upload-screen-recording/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload recording')
      }

      console.log('Screen recording uploaded successfully')
    } catch (error) {
      console.error('Upload error:', error)
    }
  }

  useEffect(() => {
    if (isActive && !isRecording && recordingStatus === 'idle') {
      // Auto-start recording when exam becomes active
      setTimeout(() => {
        startRecording()
      }, 2000) // Small delay to ensure exam is fully loaded
    }

    return () => {
      if (isRecording) {
        stopRecording()
      }
    }
  }, [isActive])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording) {
        // Pause recording when tab is hidden
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.pause()
        }
      } else if (!document.hidden && isRecording) {
        // Resume recording when tab is visible
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.resume()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isRecording])

  // Don't render anything visible - this runs in the background
  return null
}

// Type for MediaSourceConstraint
type MediaSourceConstraint = 'screen' | 'window' | 'browser' | 'application'
