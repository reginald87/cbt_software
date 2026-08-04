'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/utils/axios'
import { BookOpen, Clock, User, AlertCircle, Shield, Play, Info, LogOut, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ExamInfo {
  id: number
  title: string
  description?: string
  duration_minutes: number
  total_questions: number
  passing_score: number
  start_date: string
  end_date: string
  category: string | {
    id: number
    code: string
    name: string
    description: string
  }
  instructions?: string
  status: string
}

interface StudentSession {
  exam_id: number
  attempt_id: number
  ip_address: string
  session_key: string
  start_time: string
  remaining_seconds: number
}

export default function StudentDashboard() {
  const { user, token, logout } = useAuth()
  const [exams, setExams] = useState<ExamInfo[]>([])
  const [currentSession, setCurrentSession] = useState<StudentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showExamModal, setShowExamModal] = useState<ExamInfo | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [autoSubmitTimer, setAutoSubmitTimer] = useState<NodeJS.Timeout | null>(null)
  const [attemptedExams, setAttemptedExams] = useState<Set<number>>(new Set())

  // Fetch available exams
  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        console.log('No token available, skipping data fetch')
        setLoading(false)
        return
      }

      try {
        // Fetch exams
        const examsResponse = await api.get('/exams/?status=published')
        setExams(examsResponse.data)
        
        // Fetch student's attempts to identify already attempted exams
        const attemptsResponse = await api.get('/results/attempts/')
        const attemptedExamIds = new Set<number>(
          attemptsResponse.data.map((attempt: any) => Number(attempt.exam_id))
        )
        setAttemptedExams(attemptedExamIds)
        
      } catch (error: any) {
        console.error('Failed to fetch data:', error)
        
        // Handle 401 errors specifically
        if (error.response?.status === 401) {
          console.error('Authentication error - token may be expired')
          toast.error('Your session has expired. Please log in again.', {
            duration: 5000,
            position: 'top-center'
          })
          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = '/login'
          }, 2000)
        } else {
          toast.error('Failed to load exams')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  // Countdown timer
  useEffect(() => {
    if (countdown > 0 && currentSession) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1)
      }, 1000)
      setAutoSubmitTimer(timer)
    } else if (countdown === 0 && currentSession) {
      handleAutoSubmit()
    }

    return () => {
      if (autoSubmitTimer) {
        clearTimeout(autoSubmitTimer)
      }
    }
  }, [countdown, currentSession])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartExam = async (exam: ExamInfo) => {
    // Check if exam has already been attempted
    if (attemptedExams.has(exam.id)) {
      toast.error('You have already attempted this exam. Each exam can only be taken once.', {
        duration: 5000,
        position: 'top-center'
      })
      return
    }
    
    setShowExamModal(exam)
  }

  const handleConfirmStartExam = async () => {
    if (!showExamModal) return

    try {
      const response = await api.post(`/results/start/?exam_id=${showExamModal.id}`)

      const sessionData = response.data
      setCurrentSession(sessionData)
      setCountdown(sessionData.remaining_seconds)
      setShowExamModal(null)

      // Redirect to exam page
      window.location.href = `/dashboard/take-exam?examId=${sessionData.exam_id}&attemptId=${sessionData.attempt_id}`

    } catch (error: any) {
      console.error('Failed to start exam:', error)
      
      // Handle specific error messages
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to start exam'
      
      if (errorMessage.includes('already attempted') || errorMessage.includes('already has an in-progress attempt')) {
        toast.error('You have already attempted this exam. Each exam can only be taken once.', {
          duration: 5000,
          position: 'top-center'
        })
      } else {
        toast.error(errorMessage, {
          duration: 4000,
          position: 'top-center'
        })
      }
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
      toast.error('Failed to logout')
    }
  }

  const handleAutoSubmit = async () => {
    if (!currentSession) return

    try {
      await api.post(`/results/${currentSession.attempt_id}/submit/`, {})

      toast.success('Exam auto-submitted due to time limit')
      setCurrentSession(null)
      setCountdown(0)

      // Redirect to results
      window.location.href = '/dashboard/results'

    } catch (error) {
      console.error('Auto-submit failed:', error)
      toast.error('Auto-submit failed')
    }
  }

  const getExamStatus = (exam: ExamInfo) => {
    const now = new Date()
    const startDate = new Date(exam.start_date)
    const endDate = new Date(exam.end_date)

    // Check if exam is actually available right now
    if (now < startDate) return 'upcoming'
    if (now > endDate) return 'expired'
    return 'available'
  }

  const isExamCurrentlyAvailable = (exam: ExamInfo) => {
    const status = getExamStatus(exam)
    return status === 'available'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'available': return 'text-green-600 bg-green-50 border-green-200'
      case 'expired': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Filter exams
  const availableExams = exams.filter(isExamCurrentlyAvailable)
  const upcomingExams = exams.filter(exam => getExamStatus(exam) === 'upcoming')
  const expiredExams = exams.filter(exam => getExamStatus(exam) === 'expired')

  return (
    <div className="space-y-6">
      {/* Student Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 relative flex-shrink-0">
              {user?.profile_picture ? (
                <img 
                  src={user.profile_picture} 
                  alt={`${user.first_name} ${user.last_name}'s photo`}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {user?.first_name} {user?.last_name}
              </h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <p className="text-xs text-gray-400">ID: {user?.username}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-500">IP Address</div>
              <div className="font-mono text-sm text-gray-900">192.168.1.100</div>
              <div className="text-xs text-gray-400">Unique Session: {currentSession?.session_key || 'N/A'}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Current Session Status */}
      {currentSession && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-red-600" />
              <div>
                <h3 className="text-lg font-semibold text-red-900">Exam in Progress</h3>
                <p className="text-red-700">Time Remaining: {formatTime(countdown)}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-red-600">Auto-submit when time expires</div>
              <div className="text-2xl font-bold text-red-900">{formatTime(countdown)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Available Exams */}
      <div className="px-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Available Exams</h3>
        
        {/* No exams available */}
        {availableExams.length === 0 && upcomingExams.length === 0 && expiredExams.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Exams Available</h4>
            <p className="text-gray-500">There are no exams scheduled for you at this time.</p>
          </div>
        )}

        {/* Currently Available Exams */}
        {availableExams.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-medium text-green-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Available Now ({availableExams.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableExams.map((exam) => (
                <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">{exam.title}</h4>
                      <p className="text-sm text-gray-500">
                        {typeof exam.category === 'string' ? exam.category : exam.category?.name}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{exam.duration_minutes} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Questions:</span>
                        <span className="font-medium">{exam.total_questions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Passing Score:</span>
                        <span className="font-medium">{exam.passing_score}%</span>
                      </div>
                    </div>

                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      attemptedExams.has(exam.id) 
                        ? 'text-gray-600 bg-gray-50 border-gray-200' 
                        : 'text-green-600 bg-green-50 border-green-200'
                    }`}>
                      {attemptedExams.has(exam.id) ? 'ALREADY ATTEMPTED' : 'AVAILABLE NOW'}
                    </div>

                    <button
                      onClick={() => handleStartExam(exam)}
                      disabled={!!currentSession || attemptedExams.has(exam.id)}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        attemptedExams.has(exam.id) 
                          ? 'bg-gray-400 text-white cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {attemptedExams.has(exam.id) ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {currentSession ? 'Exam in Progress' : 
                       attemptedExams.has(exam.id) ? 'Already Attempted' : 'Start Exam'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Exams */}
        {upcomingExams.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-medium text-yellow-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              Upcoming Exams ({upcomingExams.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingExams.map((exam) => (
                <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm opacity-75">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">{exam.title}</h4>
                      <p className="text-sm text-gray-500">
                        {typeof exam.category === 'string' ? exam.category : exam.category?.name}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Starts:</span>
                        <span className="font-medium">{new Date(exam.start_date).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{exam.duration_minutes} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Questions:</span>
                        <span className="font-medium">{exam.total_questions}</span>
                      </div>
                    </div>

                    <div className="px-3 py-1 rounded-full text-xs font-medium border text-yellow-600 bg-yellow-50 border-yellow-200">
                      STARTS SOON
                    </div>

                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                    >
                      <Clock className="w-4 h-4" />
                      Not Available Yet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expired Exams */}
        {expiredExams.length > 0 && (
          <div>
            <h4 className="text-lg font-medium text-gray-600 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              Expired Exams ({expiredExams.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {expiredExams.map((exam) => (
                <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm opacity-50">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">{exam.title}</h4>
                      <p className="text-sm text-gray-500">
                        {typeof exam.category === 'string' ? exam.category : exam.category?.name}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ended:</span>
                        <span className="font-medium">{new Date(exam.end_date).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">{exam.duration_minutes} min</span>
                      </div>
                    </div>

                    <div className="px-3 py-1 rounded-full text-xs font-medium border text-gray-600 bg-gray-50 border-gray-200">
                      EXPIRED
                    </div>

                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Exam Expired
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Exam Instructions Modal */}
      {showExamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Exam Instructions</h3>
                <button
                  onClick={() => setShowExamModal(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">{showExamModal.title}</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="font-medium">{showExamModal.duration_minutes} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Questions:</span>
                      <span className="font-medium">{showExamModal.total_questions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Passing Score:</span>
                      <span className="font-medium">{showExamModal.passing_score}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Start Time:</span>
                      <span className="font-medium">{new Date(showExamModal.start_date).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>End Time:</span>
                      <span className="font-medium">{new Date(showExamModal.end_date).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                {showExamModal.instructions && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Exam Instructions:</h5>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                      {showExamModal.instructions}
                    </div>
                  </div>
                )}
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h5 className="font-medium text-red-900 mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Important Security Rules & Monitoring
                  </h5>
                  <ul className="space-y-2 text-sm text-red-800">
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">•</span>
                      <span><strong>Do NOT navigate away</strong> from this page during exam</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">•</span>
                      <span><strong>Do NOT open</strong> new browser tabs or windows</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">•</span>
                      <span><strong>Do NOT copy</strong> or print exam questions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">•</span>
                      <span><strong>Screen activity</strong> is being monitored in real-time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">•</span>
                      <span><strong>Tab switching</strong> will be detected and logged</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">•</span>
                      <span><strong>Unauthorized behavior</strong> will result in immediate disqualification</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Exam Guidelines
                  </h5>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>Read each question carefully before answering</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>Manage your time wisely - timer will auto-submit when expired</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>Review your answers before submitting if time permits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>Ensure stable internet connection throughout exam</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h5 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Final Confirmation
                  </h5>
                  <p className="text-sm text-yellow-800">
                    By clicking "Start Exam", you confirm that you have read and understood all the rules above. 
                    Any violation may result in automatic disqualification and disciplinary action.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleConfirmStartExam}
                  className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Exam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
