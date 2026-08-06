'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import TakeExam from '@/components/dashboard/TakeExam'
import { useAuth } from '@/contexts/AuthContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function TakeExamPage() {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth()
  const searchParams = useSearchParams()
  const [examId, setExamId] = useState<number | null>(null)
  const [attemptId, setAttemptId] = useState<number | null>(null)

  useEffect(() => {
    const examIdParam = searchParams.get('examId')
    const attemptIdParam = searchParams.get('attemptId')
    
    if (examIdParam && attemptIdParam) {
      setExamId(parseInt(examIdParam))
      setAttemptId(parseInt(attemptIdParam))
    }
  }, [searchParams])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    window.location.href = '/'
    return null
  }

  if (mustChangePassword) {
    // Force first-login password change before allowing exam access
    window.location.href = '/change-password'
    return null
  }

  if (!examId || !attemptId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Exam Access</h2>
          <p className="text-gray-600 mb-4">Missing exam or attempt information.</p>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const handleExit = () => {
    window.location.href = '/dashboard'
  }

  return <TakeExam examId={examId} attemptId={attemptId} onExit={handleExit} />
}
