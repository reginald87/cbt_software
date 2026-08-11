'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/utils/axios'
import {
  BookOpen, Clock, User, AlertCircle, Shield, Play, Info, LogOut,
  CheckCircle, GraduationCap, CalendarClock, Award, Building2,
  FileText, Trophy, XCircle, ClipboardList, LayoutGrid, ListChecks,
  Sparkles, Hourglass, Timer
} from 'lucide-react'
import toast from 'react-hot-toast'
import StudentEncouragement from './StudentEncouragement'

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
  questions_per_paper?: number
}

interface StudentSession {
  exam_id: number
  attempt_id: number
  ip_address: string
  session_key: string
  start_time: string
  remaining_seconds: number
}

interface StudentAttempt {
  id: number
  exam_id: number
  exam_title: string
  exam_category?: string | null
  status: string
  percentage?: number | null
  grade?: string | null
  is_passed: boolean
  start_time: string
  submitted_at?: string | null
  time_taken_seconds?: number | null
}

type Tab = 'exams' | 'results'

const USER_TYPE_LABELS: Record<string, string> = {
  matriculated: 'Matriculated Student',
  '100level': '100-Level Student',
  intending: 'Intending Student',
  admin: 'Administrator',
  staff: 'Staff',
}

/** Server-synced live clock — ticks in its own component so the rest of the
 *  dashboard doesn't re-render every second. */
function LiveClock({ offsetMs = 0, className = '' }: { offsetMs?: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])
  return (
    <span className={className}>
      {new Date(now + offsetMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

/** Live window countdown, e.g. "Closes in 1h 04m" or "Starts in 3m 20s". */
function WindowCountdown({ target, offsetMs = 0, className = '' }: { target: string; offsetMs?: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])
  const diff = new Date(target).getTime() - (now + offsetMs)
  const abs = Math.max(0, diff)
  const h = Math.floor(abs / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  const s = Math.floor((abs % 60000) / 1000)
  const label = h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`
  return <span className={className}>{label}</span>
}

export default function StudentDashboard() {
  const { user, token, logout } = useAuth()
  const [exams, setExams] = useState<ExamInfo[]>([])
  const [attempts, setAttempts] = useState<StudentAttempt[]>([])
  const [currentSession, setCurrentSession] = useState<StudentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showExamModal, setShowExamModal] = useState<ExamInfo | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('exams')
  const serverTimeOffsetRef = useRef<number>(0)

  const fullName = user?.first_name || user?.last_name
    ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
    : (user?.username || 'Student')

  const identifier = user?.matric_number || user?.jamb_number || user?.username || ''
  const department = user?.department || 'Department not specified'
  const userTypeLabel = user?.user_type ? USER_TYPE_LABELS[user.user_type] || user.user_type : ''

  // Fetch available exams
  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        console.log('No token available, skipping data fetch')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const [examsRes, attemptsRes, sessionRes] = await Promise.all([
          api.get('/exams/available/'),
          api.get('/results/attempts/'),
          api.get('/results/current-session/'),
        ])

        const examsData = examsRes.data
        const attemptsData = attemptsRes.data

        // Use server time for availability so a skewed client clock can't
        // hide an exam that is inside its live window on the server.
        if (Array.isArray(examsData) && examsData[0]?.server_time) {
          serverTimeOffsetRef.current = new Date(examsData[0].server_time).getTime() - Date.now()
        }

        setExams(examsData)
        setAttempts(attemptsData)

        if (sessionRes.data?.active) {
          setCurrentSession(sessionRes.data.session)
          setCountdown(sessionRes.data.session.remaining_seconds)
        }
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch exams:', error)
        setLoading(false)
      }
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Countdown effect
  useEffect(() => {
    if (!currentSession) return
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleAutoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession])

  const handleGoToExam = () => {
    if (!currentSession) return
    window.location.href = `/dashboard/take-exam?examId=${currentSession.exam_id}&attemptId=${currentSession.attempt_id}`
  }

  const handleAutoSubmit = async () => {
    if (!currentSession) return

    try {
      await api.post(`/results/${currentSession.attempt_id}/submit/`, {})

      toast.success('Exam auto-submitted due to time limit')
      setCurrentSession(null)
      setCountdown(0)

      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Auto-submit failed:', error)
      toast.error('Auto-submit failed')
    }
  }

  const handleStartExam = async (exam: ExamInfo) => {
    try {
      const res = await api.post(`/results/start/?exam_id=${exam.id}`)
      console.log('Start exam response:', res.data)
      if (res.data?.attempt_id) {
        window.location.href = `/dashboard/take-exam?examId=${exam.id}&attemptId=${res.data.attempt_id}`
      } else if (res.data?.id) {
        window.location.href = `/dashboard/take-exam?examId=${exam.id}&attemptId=${res.data.id}`
      } else if (res.data?.session?.attempt_id) {
        window.location.href = `/dashboard/take-exam?examId=${exam.id}&attemptId=${res.data.session.attempt_id}`
      } else {
        toast.error('Could not start exam. Please try again.')
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Could not start exam. Please try again.')
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed:', error)
      toast.error('Failed to logout')
    }
  }

  const getExamStatus = (exam: ExamInfo) => {
    const offset = serverTimeOffsetRef.current
    const now = new Date(Date.now() + offset)

    const startDate = new Date(exam.start_date)
    const endDate = new Date(exam.end_date)

    if (now < startDate) return 'upcoming'
    if (now > endDate) return 'expired'
    return 'available'
  }

  const isExamCurrentlyAvailable = (exam: ExamInfo) => {
    const status = getExamStatus(exam)
    return status === 'available'
  }

  const paperQuestions = (exam: ExamInfo) => exam.questions_per_paper || exam.total_questions

  const attemptedExamIds = new Set(attempts.filter((a) => a.status !== 'in_progress').map((a) => a.exam_id))

  const completedAttempts = attempts
    .filter((a) => a.status !== 'in_progress')
    .sort((a, b) => new Date(b.submitted_at || b.start_time).getTime() - new Date(a.submitted_at || a.start_time).getTime())

  const inProgressAttempts = attempts.filter((a) => a.status === 'in_progress')

  // Format time as HH:MM:SS
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds]
      .map((n) => String(n).padStart(2, '0'))
      .join(':')
  }

  const formatDate = (iso?: string | null): string => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatDuration = (seconds?: number | null): string => {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    return `${mins}m ${secs}s`
  }

  const getCategoryName = (exam: ExamInfo) =>
    typeof exam.category === 'string' ? exam.category : exam.category?.name || 'General'

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full" />
        <p className="text-sm text-slate-500">Loading your dashboard…</p>
      </div>
    )
  }

  const availableExams = exams.filter(isExamCurrentlyAvailable)

  const stats = {
    available: availableExams.length,
    completed: completedAttempts.length,
    inProgress: inProgressAttempts.length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Student Profile Header ─────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-800 via-primary-700 to-primary-600 text-white shadow-lg">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-24 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="h-20 w-20 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/30 overflow-hidden">
                {user?.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt={`${user.first_name} ${user.last_name}'s photo`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-success-400 border-2 border-primary-700 flex items-center justify-center">
                <span className="text-[10px] text-primary-950 font-bold">✓</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-primary-200 text-xs font-medium uppercase tracking-widest mb-1">
                {userTypeLabel || 'Student Portal'}
              </p>
              <h1 className="text-2xl font-bold truncate">{fullName}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-primary-100">
                <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-white bg-white/10 px-2.5 py-0.5 rounded-md">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {identifier}
                </span>
                {department && department !== 'Department not specified' && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {department}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="md:ml-auto flex items-center gap-3">
            <div className="hidden lg:block text-right">
              <p className="text-primary-200 text-xs">Signed in as</p>
              <p className="text-sm font-medium">{user?.email || user?.username}</p>
              <p className="text-primary-200 text-xs mt-1">
                <LiveClock offsetMs={serverTimeOffsetRef.current} className="font-mono" />
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur text-white rounded-xl transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-success-50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-success-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.available}</div>
            <div className="text-xs text-slate-500">Available Now</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-primary-50 flex items-center justify-center">
            <Award className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.completed}</div>
            <div className="text-xs text-slate-500">Completed</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-error-50 flex items-center justify-center">
            <Timer className="w-5 h-5 text-error-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.inProgress}</div>
            <div className="text-xs text-slate-500">In Progress</div>
          </div>
        </div>
      </div>

      {/* ── Active Session Banner ──────────────────────────────── */}
      {currentSession && (
        <div className="rounded-xl border border-primary-200 bg-gradient-to-r from-primary-50 to-white p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-primary-100 flex items-center justify-center">
              <Hourglass className="w-5 h-5 text-primary-700" />
            </div>
            <div>
              <h3 className="font-semibold text-primary-900">Exam in Progress</h3>
              <p className="text-sm text-primary-700">Your session is active — time is counting down.</p>
            </div>
          </div>
          <div className="sm:ml-auto flex items-center gap-4">
            <div className="text-center">
              <div className="font-mono text-xl font-bold text-primary-700 tabular-nums">{formatTime(countdown)}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wide">Time Left</div>
            </div>
            <button
              onClick={handleGoToExam}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-medium"
            >
              <Play className="w-4 h-4" />
              Resume Exam
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('exams')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'exams'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Available Exams
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'results'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          My Results
          {completedAttempts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 text-[10px] font-semibold">
              {completedAttempts.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB: Available Exams ───────────────────────────────── */}
      {activeTab === 'exams' && (
        <div>
          <StudentEncouragement
            variant="hero"
            className="mb-8"
            message={`Welcome back! You have ${availableExams.length} exam(s) ready for you right now. Take a deep breath — you've got this!`}
          />

          {availableExams.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-1">No Exams Available</h4>
              <p className="text-slate-500">There are no exams scheduled for you at this time.</p>
            </div>
          )}

          {/* Currently Available */}
          {availableExams.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-2.5 w-2.5 rounded-full bg-success-500 animate-pulse" />
                <h3 className="text-lg font-semibold text-slate-900">Available Now</h3>
                <span className="px-2 py-0.5 rounded-full bg-success-50 text-success-700 text-xs font-medium">
                  {availableExams.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {availableExams.map((exam) => {
                  const attempted = attemptedExamIds.has(exam.id)
                  const inProgressAttempt = inProgressAttempts.find((a) => a.exam_id === exam.id)
                  const isResumable = !!inProgressAttempt
                  const cardAction = () => {
                    if (inProgressAttempt) {
                      window.location.href = `/dashboard/take-exam?examId=${inProgressAttempt.exam_id}&attemptId=${inProgressAttempt.id}`
                    } else {
                      setShowExamModal(exam)
                    }
                  }
                  return (
                    <div
                      key={exam.id}
                      className={`group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all hover:border-primary-200 ${
                        attempted ? 'opacity-80' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center shrink-0">
                            <GraduationCap className="w-5 h-5 text-primary-600" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-slate-900 leading-snug line-clamp-2">{exam.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{getCategoryName(exam)}</p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide border ${
                            isResumable
                              ? 'text-warning-700 bg-warning-50 border-warning-200'
                              : attempted
                                ? 'text-slate-500 bg-slate-50 border-slate-200'
                                : 'text-success-700 bg-success-50 border-success-200'
                          }`}
                        >
                          {isResumable ? 'IN PROGRESS' : attempted ? 'COMPLETED' : 'AVAILABLE'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-5">
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <Clock className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                          <div className="text-sm font-semibold text-slate-800">{exam.duration_minutes}m</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Duration</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <FileText className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                          <div className="text-sm font-semibold text-slate-800">{paperQuestions(exam)}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Questions</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                          <Trophy className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                          <div className="text-sm font-semibold text-slate-800">{exam.passing_score}%</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Pass Mark</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                          {getExamStatus(exam) === 'upcoming' ? (
                            <>
                              Starts in{' '}
                              <WindowCountdown target={exam.start_date} offsetMs={serverTimeOffsetRef.current} className="font-mono font-semibold text-primary-600" />
                            </>
                          ) : (
                            <>
                              Closes in{' '}
                              <WindowCountdown target={exam.end_date} offsetMs={serverTimeOffsetRef.current} className="font-mono font-semibold text-primary-600" />
                            </>
                          )}
                        </span>
                      </div>

                      <button
                        onClick={cardAction}
                        disabled={attempted || !!currentSession && !isResumable}
                        className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                          attempted
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-600/20 active:scale-[0.99]'
                        }`}
                      >
                        {isResumable ? (
                          <>
                            <Play className="w-4 h-4" />
                            Resume Exam
                          </>
                        ) : attempted ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Already Attempted
                          </>
                        ) : currentSession ? (
                          <>
                            <Hourglass className="w-4 h-4" />
                            Exam in Progress
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Start Exam
                          </>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── TAB: My Results ────────────────────────────────────── */}
      {activeTab === 'results' && (
        <div>
          {completedAttempts.length === 0 && inProgressAttempts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="h-16 w-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="h-8 w-8 text-primary-600" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-1">No Results Yet</h4>
              <p className="text-slate-500">Results of exams you have completed will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {inProgressAttempts.length > 0 && (
                <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-warning-100 flex items-center justify-center">
                      <Hourglass className="w-5 h-5 text-warning-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-warning-900">
                        {inProgressAttempts[0].exam_title}
                      </p>
                      <p className="text-sm text-warning-700">This exam is still in progress.</p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      window.location.href = `/dashboard/take-exam?examId=${inProgressAttempts[0].exam_id}&attemptId=${inProgressAttempts[0].id}`
                    }
                    className="sm:ml-auto px-4 py-2 bg-warning-600 hover:bg-warning-700 text-white rounded-lg text-sm font-medium"
                  >
                    Resume
                  </button>
                </div>
              )}

              {completedAttempts.map((attempt) => {
                const pct = attempt.percentage ?? 0
                const passed = attempt.is_passed
                return (
                  <div
                    key={attempt.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                            passed ? 'bg-success-50' : 'bg-error-50'
                          }`}
                        >
                          {passed ? (
                            <Trophy className="w-6 h-6 text-success-600" />
                          ) : (
                            <XCircle className="w-6 h-6 text-error-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-900 truncate">{attempt.exam_title}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {attempt.exam_category || 'General'} · Submitted {formatDate(attempt.submitted_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 md:ml-auto">
                        <div className="w-28 sm:w-32">
                          <div className="flex items-baseline justify-between">
                            <div className="text-lg font-bold text-slate-900 tabular-nums">{Math.round(pct)}%</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Score</div>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${passed ? 'bg-success-500' : 'bg-error-400'}`}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-center hidden sm:block">
                          <div className="text-lg font-semibold text-slate-700">{attempt.grade || '—'}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Grade</div>
                        </div>
                        <div className="text-center hidden sm:block">
                          <div className="text-lg font-semibold text-slate-700 tabular-nums">
                            {formatDuration(attempt.time_taken_seconds)}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Time Used</div>
                        </div>
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                            passed
                              ? 'bg-success-100 text-success-700'
                              : 'bg-error-100 text-error-700'
                          }`}
                        >
                          {passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Exam Instructions Modal ────────────────────────────── */}
      {showExamModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Exam Instructions</h3>
                  <p className="text-xs text-slate-500">{showExamModal.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowExamModal(null)}
                className="px-4 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <Clock className="w-4 h-4 text-primary-600 mx-auto mb-1" />
                  <div className="text-sm font-semibold text-slate-800">{showExamModal.duration_minutes} min</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Duration</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <FileText className="w-4 h-4 text-primary-600 mx-auto mb-1" />
                  <div className="text-sm font-semibold text-slate-800">{paperQuestions(showExamModal)}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Questions</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <Trophy className="w-4 h-4 text-primary-600 mx-auto mb-1" />
                  <div className="text-sm font-semibold text-slate-800">{showExamModal.passing_score}%</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Pass Mark</div>
                </div>
              </div>

              {showExamModal.instructions && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed">
                  {showExamModal.instructions}
                </div>
              )}

              <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
                <h5 className="font-semibold text-warning-900 mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Important Security Rules &amp; Monitoring
                </h5>
                <ul className="space-y-2 text-sm text-warning-800">
                  <li className="flex items-start gap-2">
                    <span className="text-warning-600 mt-1">•</span>
                    <span><strong>Do NOT navigate away</strong> from this page during the exam.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-warning-600 mt-1">•</span>
                    <span><strong>Do NOT open</strong> new browser tabs or windows.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-warning-600 mt-1">•</span>
                    <span><strong>Do NOT copy</strong> or print exam questions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-warning-600 mt-1">•</span>
                    <span><strong>Screen activity</strong> is being monitored in real-time.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-warning-600 mt-1">•</span>
                    <span><strong>Tab switching</strong> will automatically submit your exam and end your attempt immediately.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-warning-600 mt-1">•</span>
                    <span><strong>Unauthorized behavior</strong> will result in immediate disqualification.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
                <h5 className="font-semibold text-primary-900 mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Exam Guidelines
                </h5>
                <ul className="space-y-2 text-sm text-primary-800">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 mt-1">•</span>
                    <span>Read each question carefully before answering.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 mt-1">•</span>
                    <span>Manage your time wisely — the timer will auto-submit when it expires.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 mt-1">•</span>
                    <span>Review your answers before submitting if time permits.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 mt-1">•</span>
                    <span>Ensure a stable internet connection throughout the exam.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
                <h5 className="font-semibold text-warning-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Final Confirmation
                </h5>
                <p className="text-sm text-warning-800">
                  By clicking &quot;Start Exam&quot;, you confirm that you have read and understood all the rules above.
                  Any violation may result in automatic disqualification and disciplinary action.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowExamModal(null)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStartExam(showExamModal)}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-sm shadow-primary-600/20 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
