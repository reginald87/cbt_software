'use client'

import { useEffect, useRef } from 'react'
import { getApiUrl } from '@/config/api'

interface TabSwitchDetectorProps {
  examId: number
  attemptId: number
  token: string
  isActive: boolean
  onViolation?: () => void
}

interface TabSwitchEvent {
  timestamp: number
  type: 'blur' | 'focus' | 'visibility_change'
  isActive: boolean
}

export default function TabSwitchDetector({ examId, attemptId, token, isActive, onViolation }: TabSwitchDetectorProps) {
  const eventsRef = useRef<TabSwitchEvent[]>([])
  const violatedRef = useRef(false)
  const onViolationRef = useRef(onViolation)

  useEffect(() => {
    onViolationRef.current = onViolation
  }, [onViolation])

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

  const handleViolation = () => {
    if (!isActive || violatedRef.current) return
    violatedRef.current = true

    if (onViolationRef.current) {
      onViolationRef.current()
    }
  }

  const handleVisibilityChange = () => {
    if (!isActive) return

    const isHidden = document.hidden
    const eventType = isHidden ? 'visibility_change' : 'focus'

    if (isHidden) {
      // A tab switch is a hard violation: submit the exam immediately.
      handleViolation()
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
    }
  }, [isActive])

  return null
}
