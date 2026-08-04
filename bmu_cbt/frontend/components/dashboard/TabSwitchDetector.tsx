'use client'

import { useEffect, useRef, useState } from 'react'
import { getApiUrl } from '@/config/api'

interface TabSwitchDetectorProps {
  examId: number
  attemptId: number
  token: string
  isActive: boolean
}

interface TabSwitchEvent {
  timestamp: number
  type: 'blur' | 'focus' | 'visibility_change'
  isActive: boolean
}

export default function TabSwitchDetector({ examId, attemptId, token, isActive }: TabSwitchDetectorProps) {
  const [warningCount, setWarningCount] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const eventsRef = useRef<TabSwitchEvent[]>([])
  const warningTimeoutRef = useRef<NodeJS.Timeout>()

  const MAX_WARNINGS = 3
  const BLOCK_DURATION = 30000 // 30 seconds

  const logTabSwitch = async (eventType: 'blur' | 'focus' | 'visibility_change', isActive: boolean) => {
    if (!isActive) return

    const event: TabSwitchEvent = {
      timestamp: Date.now(),
      type: eventType,
      isActive
    }

    eventsRef.current.push(event)

    try {
      await fetch(`${getApiUrl()}/results/${attemptId}/log-tab-switch/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event_type: eventType,
          timestamp: event.timestamp,
          is_active: isActive
        })
      })
    } catch (error) {
      console.error('Failed to log tab switch:', error)
    }
  }

  const handleVisibilityChange = () => {
    if (!isActive) return

    const isHidden = document.hidden
    const eventType = isHidden ? 'visibility_change' : 'focus'
    
    if (isHidden) {
      handleTabSwitch()
    }
    
    logTabSwitch(eventType, !isHidden)
  }

  const handleBlur = () => {
    if (!isActive) return
    logTabSwitch('blur', false)
  }

  const handleFocus = () => {
    if (!isActive) return
    logTabSwitch('focus', true)
  }

  const handleTabSwitch = () => {
    if (!isActive) return

    const newWarningCount = warningCount + 1
    setWarningCount(newWarningCount)

    // Show warning
    setShowWarning(true)
    
    // Clear existing timeout
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }

    // Hide warning after 5 seconds
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(false)
    }, 5000)

    // Block exam after max warnings
    if (newWarningCount >= MAX_WARNINGS) {
      setIsBlocked(true)
      
      // Auto-unblock after BLOCK_DURATION
      setTimeout(() => {
        setIsBlocked(false)
        setWarningCount(0) // Reset warnings after unblock
      }, BLOCK_DURATION)
    }
  }

  const handleContextMenu = (e: MouseEvent) => {
    if (!isActive) return
    
    // Prevent right-click menu
    e.preventDefault()
    
    // Log as potential cheating attempt
    logTabSwitch('visibility_change', false)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isActive) return

    // Block common keyboard shortcuts
    const blockedKeys = [
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
      'Escape', 'Tab', 'Control', 'Alt', 'Meta'
    ]

    if (blockedKeys.includes(e.key) || 
        (e.ctrlKey && ['c', 'v', 'x', 'a', 's', 'r', 'f', 'g'].includes(e.key.toLowerCase())) ||
        (e.altKey && ['tab', 'f4'].includes(e.key.toLowerCase()))) {
      
      e.preventDefault()
      
      // Log as potential cheating attempt
      logTabSwitch('visibility_change', false)
    }
  }

  const handleCopyPaste = (e: ClipboardEvent) => {
    if (!isActive) return
    
    e.preventDefault()
    
    // Log as potential cheating attempt
    logTabSwitch('visibility_change', false)
  }

  useEffect(() => {
    if (!isActive) return

    // Visibility API
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Window focus/blur
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    
    // Context menu (right-click)
    document.addEventListener('contextmenu', handleContextMenu)
    
    // Keyboard shortcuts
    window.addEventListener('keydown', handleKeyDown)
    
    // Copy/paste
    document.addEventListener('copy', handleCopyPaste)
    document.addEventListener('paste', handleCopyPaste)
    document.addEventListener('cut', handleCopyPaste)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('copy', handleCopyPaste)
      document.removeEventListener('paste', handleCopyPaste)
      document.removeEventListener('cut', handleCopyPaste)
      
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current)
      }
    }
  }, [isActive, warningCount])

  if (!isActive) return null

  return (
    <>
      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Tab Switch Detected!</h3>
                <p className="text-sm text-gray-600">
                  Warning {warningCount} of {MAX_WARNINGS}. Switching tabs during exams is prohibited.
                </p>
              </div>
            </div>
            
            {warningCount >= MAX_WARNINGS - 1 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-sm text-red-600">
                  <strong>Final Warning!</strong> One more tab switch will block your exam for 30 seconds.
                </p>
              </div>
            )}
            
            <button
              onClick={() => setShowWarning(false)}
              className="w-full bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* Exam Blocked Modal */}
      {isBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Exam Blocked</h3>
                <p className="text-sm text-gray-600">
                  Your exam has been temporarily blocked due to multiple tab switches.
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <p className="text-sm text-blue-600">
                Please wait 30 seconds. The exam will automatically resume.
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Exam will resume shortly...
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
