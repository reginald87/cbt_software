'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface SessionSecurityProps {
  examId: number
  attemptId: number
  token: string
  isActive: boolean
}

export default function SessionSecurity({ examId, attemptId, token, isActive }: SessionSecurityProps) {
  const [sessionValid, setSessionValid] = useState(true)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const checkIntervalRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<number>(Date.now())

  const checkSessionValidity = async () => {
    if (!isActive || isChecking) return

    try {
      setIsChecking(true)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/results/${attemptId}/check-session/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Exam-ID': examId.toString(),
          'X-Attempt-ID': attemptId.toString()
        }
      })

      if (!response.ok) {
        throw new Error('Session check failed')
      }

      const data = await response.json()

      if (!data.valid) {
        setSessionValid(false)
        setWarningMessage(data.message || 'Session security issue detected')
        
        // Force logout or redirect
        setTimeout(() => {
          window.location.href = '/login?reason=session_invalid'
        }, 3000)
      } else {
        setSessionValid(true)
        setWarningMessage(null)
      }

      // Update last activity
      lastActivityRef.current = Date.now()

    } catch (error) {
      console.error('Session check error:', error)
      // Don't show error to user, just continue
    } finally {
      setIsChecking(false)
    }
  }

  const updateActivity = () => {
    lastActivityRef.current = Date.now()
    
    // Send activity update to server
    if (isActive) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/results/${attemptId}/update-activity/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp: Date.now(),
          activity_type: 'interaction'
        })
      }).catch(error => {
        console.error('Activity update error:', error)
      })
    }
  }

  const detectEnvironmentAnomalies = () => {
    // Check for suspicious browser modifications
    const anomalies = []

    // Check if developer tools are open
    if (window.outerHeight - window.innerHeight > 200 || window.outerWidth - window.innerWidth > 200) {
      anomalies.push('Developer tools detected')
    }

    // Check for browser zoom
    const zoomLevel = Math.round(window.devicePixelRatio * 100)
    if (zoomLevel < 90 || zoomLevel > 110) {
      anomalies.push(`Browser zoom detected: ${zoomLevel}%`)
    }

    // Check for unusual screen resolution
    if (window.screen.width < 1024 || window.screen.height < 768) {
      anomalies.push(`Unusual screen resolution: ${window.screen.width}x${window.screen.height}`)
    }

    // Log anomalies if any
    if (anomalies.length > 0 && isActive) {
      console.warn('Environment anomalies detected:', anomalies)
      
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/results/${attemptId}/log-anomaly/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          anomalies: anomalies,
          timestamp: Date.now(),
          user_agent: navigator.userAgent,
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          window_size: `${window.innerWidth}x${window.innerHeight}`
        })
      }).catch(error => {
        console.error('Anomaly logging error:', error)
      })
    }
  }

  useEffect(() => {
    if (!isActive) return

    // Start periodic session checks
    checkIntervalRef.current = setInterval(() => {
      checkSessionValidity()
      detectEnvironmentAnomalies()
    }, 30000) // Check every 30 seconds

    // Initial check
    setTimeout(() => {
      checkSessionValidity()
      detectEnvironmentAnomalies()
    }, 5000)

    // Set up activity monitoring
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      updateActivity()
    }

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Prevent right-click context menu
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }
    document.addEventListener('contextmenu', preventContextMenu)

    // Prevent text selection
    const preventSelection = (e: Event) => {
      e.preventDefault()
      return false
    }
    document.addEventListener('selectstart', preventSelection)
    document.addEventListener('dragstart', preventSelection)

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }

      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })

      document.removeEventListener('contextmenu', preventContextMenu)
      document.removeEventListener('selectstart', preventSelection)
      document.removeEventListener('dragstart', preventSelection)
    }
  }, [isActive])

  // Monitor for window focus changes
  useEffect(() => {
    const handleFocus = () => {
      if (isActive) {
        checkSessionValidity()
      }
    }

    const handleBlur = () => {
      if (isActive) {
        // Log window blur
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/results/${attemptId}/log-window-blur/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            timestamp: Date.now()
          })
        }).catch(error => {
          console.error('Window blur logging error:', error)
        })
      }
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [isActive])

  // Don't render anything visible - this runs in the background
  return null
}
