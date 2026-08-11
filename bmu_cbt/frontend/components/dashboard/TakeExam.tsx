'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import api from '@/utils/axios'
import { BookOpen, ChevronLeft, ChevronRight, Clock, Flag, Loader2, GraduationCap, CalendarClock, FolderOpen, Check, Sun, Moon, X, LayoutGrid } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import TabSwitchDetector from './TabSwitchDetector'
import ScreenRecorder from './ScreenRecorder'
import WebcamMonitor from './WebcamMonitor'
import SessionSecurity from './SessionSecurity'
import MathQuestionRenderer, { QuestionBody, MathInput, ChemInput } from './MathQuestionRenderer'
import KaTeXRenderer from './KaTeXRenderer'
import Image from 'next/image'
import StudentEncouragement from './StudentEncouragement'

// Extend the MathInput and ChemInput props to include HTML attributes
interface ExtendedMathInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  rows?: number
}

interface ExtendedChemInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  rows?: number
}

interface AnswerOption {
  id: number
  answer_text: string
  order: number
}

interface Question {
  id: number
  question_text: string
  question_type: string
  marks: number
  order: number
  explanation?: string | null
  correct_answer?: string | null
  latex_content?: string | null
  diagram_image?: string | null
  equation_type?: string | null
  answers: AnswerOption[]
  // Comprehension support
  comprehension_passage?: string | null
  comprehension_group?: string | null
  // Shared image support
  shared_image?: {
    id: number
    title: string
    image: string
    caption?: string | null
  } | null
}

interface ExamDetail {
  id: number
  title: string
  description?: string | null
  instructions?: string | null
  duration_minutes: number
  total_questions: number
  passing_score: number
  status: string
  start_date: string
  end_date: string
  show_answers: boolean
  show_score: boolean
  shuffle_questions: boolean
  shuffle_options: boolean
  allow_review: boolean
  category: {
    id: number
    code: string
    name: string
    description?: string | null
  }
}

interface AttemptAnswer {
  id: number
  question_id: number
  selected_answer_id?: number | null
  selected_answer_text?: string | null
  short_answer?: string | null
  boolean_answer?: boolean | null
  is_correct: boolean
  marks_obtained: number
  correct_answer_text?: string | null
}

interface AttemptDetail {
  id: number
  exam_id: number
  exam_title: string
  status: string
  total_marks?: number | null
  percentage?: number | null
  grade?: string | null
  is_passed: boolean
  submitted_at?: string | null
  time_taken_seconds?: number | null
  answers: AttemptAnswer[]
}

interface TakeExamProps {
  examId: number
  attemptId: number
  endTimeMs?: number
  onExit: () => void
}

type SelectedAnswers = Record<number, number | null>
type ShortAnswers = Record<number, string>
type BooleanAnswers = Record<number, boolean | null>
type NavFilter = 'all' | 'answered' | 'unanswered' | 'flagged'

function formatRemaining(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

function formatReviewDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function TakeExam({ examId, attemptId, endTimeMs, onExit }: TakeExamProps) {
  const { token, user } = useAuth()
  const [exam, setExam] = useState<ExamDetail | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswers>({})
  const [shortAnswers, setShortAnswers] = useState<ShortAnswers>({})
  const [booleanAnswers, setBooleanAnswers] = useState<BooleanAnswers>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set())
  const [savingQuestionIds, setSavingQuestionIds] = useState<Set<number>>(new Set())
  const saveQueuesRef = useRef<Record<number, Promise<void>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const endTimeMsRef = useRef<number | null>(null)
  const serverTimeOffsetRef = useRef<number>(0)
  const [reviewData, setReviewData] = useState<AttemptDetail | null>(null)
  const submittedRef = useRef(false)
  const submittingRef = useRef(false)

  // Focus-mode UX state
  const [isDark, setIsDark] = useState(false)
  const [navFilter, setNavFilter] = useState<NavFilter>('all')
  const [navOpen, setNavOpen] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  // Persist theme preference
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('bmu_cbt_exam_theme')
      if (saved) setIsDark(saved === 'dark')
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    try {
      window.localStorage.setItem('bmu_cbt_exam_theme', isDark ? 'dark' : 'light')
    } catch { /* ignore */ }
  }, [isDark])

  useEffect(() => {
    if (!token) return
    void fetchExamAndQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, examId])

  useEffect(() => {
    if (!exam) return

    const key = `bmu_cbt_attempt_${attemptId}_end_time_ms`
    const existing = window.localStorage.getItem(key)
    const durationMs = exam.duration_minutes * 60 * 1000
    const correctedNow = () => Date.now() + serverTimeOffsetRef.current

    let endMs: number
    if (existing) {
      endMs = Number(existing)
      const expected = correctedNow() + durationMs
      if (Math.abs(endMs - expected) > durationMs) {
        endMs = correctedNow() + durationMs
        window.localStorage.setItem(key, String(endMs))
      }
    } else {
      endMs = typeof endTimeMs === 'number' ? endTimeMs : correctedNow() + durationMs
      window.localStorage.setItem(key, String(endMs))
    }

    endTimeMsRef.current = endMs

    const tick = () => {
      if (submittedRef.current) return
      const endTimeMs = endTimeMsRef.current
      if (!endTimeMs) return
      const left = Math.ceil((endTimeMs - correctedNow()) / 1000)
      setRemainingSeconds(left)
      if (left <= 0) {
        window.clearInterval(timer)
        void submitExam()
      }
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, attemptId])

  const fetchExamAndQuestions = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setSubmitError(null)

      const [examRes, qRes, detailRes] = await Promise.all([
        api.get(`/exams/${examId}/`),
        api.get(`/exams/${examId}/questions/?attempt_id=${attemptId}`),
        api.get(`/results/${attemptId}/`).catch(() => null),
      ])

      const serverTime = examRes.data?.server_time
      if (serverTime) {
        serverTimeOffsetRef.current = new Date(serverTime).getTime() - Date.now()
      }

      setExam(examRes.data)
      setQuestions(qRes.data || [])
      setActiveIndex(0)

      // If the attempt was already finalized (e.g. reloading after an
      // auto-submit), show the result review instead of the exam.
      if (detailRes?.data?.status && detailRes.data.status !== 'in_progress') {
        submittedRef.current = true
        setReviewData(detailRes.data)
        return
      }

      if (detailRes?.data?.answers) {
        const restoredSelected: SelectedAnswers = {}
        const restoredShort: ShortAnswers = {}
        const restoredBoolean: BooleanAnswers = {}
        for (const ans of detailRes.data.answers) {
          if (ans.selected_answer_id != null) restoredSelected[ans.question_id] = ans.selected_answer_id
          if (ans.short_answer) restoredShort[ans.question_id] = ans.short_answer
          if (ans.boolean_answer != null) restoredBoolean[ans.question_id] = ans.boolean_answer
        }
        setSelectedAnswers(restoredSelected)
        setShortAnswers(restoredShort)
        setBooleanAnswers(restoredBoolean)
      }
    } catch (e: any) {
      console.error('ERROR: Failed to fetch exam and questions:', e)
      console.error('ERROR response:', e.response?.data)
      setError(`Failed to load exam: ${e.response?.data?.detail || e.message || 'Please try again.'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const sortedQuestions = useMemo(() => {
    // Backend serves questions in the correct order (shuffled per-student when enabled).
    // Do not re-sort by `order` here as it would undo the shuffle.
    return [...questions]
  }, [questions])

  const activeQuestion = sortedQuestions[activeIndex] || null

  const indexById = useMemo(() => {
    const m = new Map<number, number>()
    sortedQuestions.forEach((q, i) => m.set(q.id, i))
    return m
  }, [sortedQuestions])

  const isQuestionAnswered = (q: Question) => {
    if (q.question_type === 'true_false') return booleanAnswers[q.id] !== null && booleanAnswers[q.id] !== undefined
    if (q.answers && q.answers.length > 0) return !!selectedAnswers[q.id]
    return !!(shortAnswers[q.id] || '').trim()
  }

  const answeredCount = useMemo(() => {
    let count = 0
    for (const q of sortedQuestions) {
      if (isQuestionAnswered(q)) count += 1
    }
    return count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedQuestions, selectedAnswers, shortAnswers, booleanAnswers])

  const unansweredCount = sortedQuestions.length - answeredCount
  const isSaving = savingQuestionIds.size > 0

  const filteredQuestions = useMemo(() => {
    switch (navFilter) {
      case 'answered': return sortedQuestions.filter(isQuestionAnswered)
      case 'unanswered': return sortedQuestions.filter(q => !isQuestionAnswered(q))
      case 'flagged': return sortedQuestions.filter(q => flaggedQuestions.has(q.id))
      default: return sortedQuestions
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedQuestions, navFilter, flaggedQuestions, selectedAnswers, shortAnswers, booleanAnswers])

  const toggleFlag = (id?: number) => {
    if (!id) return
    setFlaggedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submitAnswer = (questionId: number, payload: { selected_answer_id?: number | null; short_answer?: string | null; boolean_answer?: boolean | null }) => {
    const run = async () => {
      try {
        setSavingQuestionIds((prev) => new Set(prev).add(questionId))
        await api.post(
          `/results/${attemptId}/submit-answer/`,
          {
            question_id: questionId,
            selected_answer_id: payload.selected_answer_id ?? null,
            short_answer: payload.short_answer ?? null,
            boolean_answer: payload.boolean_answer ?? null,
            time_spent_seconds: 0,
          }
        )
      } catch (e: any) {
        console.error(e)
        setSubmitError(e.response?.data?.detail || 'Failed to save answer')
      } finally {
        setSavingQuestionIds((prev) => {
          const next = new Set(prev)
          next.delete(questionId)
          return next
        })
      }
    }
    const prev = saveQueuesRef.current[questionId] || Promise.resolve()
    const next = prev.then(run, run)
    saveQueuesRef.current[questionId] = next
    return next
  }

  const submitExam = async () => {
    if (submittingRef.current || submittedRef.current) return
    submittingRef.current = true
    try {
      setIsSubmitting(true)
      setSubmitError(null)

      // Flush any unsaved short/input answer for the active question before submitting,
      // otherwise it could be lost if the input never blurred.
      if (activeQuestion && !activeQuestion.answers?.length) {
        await submitAnswer(activeQuestion.id, { short_answer: (shortAnswers[activeQuestion.id] || '').trim() || null })
      }

      await api.post(
        `/results/${attemptId}/submit/`,
        null
      )

      const key = `bmu_cbt_attempt_${attemptId}_end_time_ms`
      window.localStorage.removeItem(key)
      submittedRef.current = true

      const detailRes = await api.get(`/results/${attemptId}/`)
      setReviewData(detailRes.data)
    } catch (e: any) {
      console.error(e)
      const msg = e.response?.data?.detail || 'Failed to submit exam'
      // The attempt was already finalized (e.g. a concurrent auto-submit raced
      // ahead of this request) — load the result instead of showing an error.
      if (e.response?.status === 400 && /not in progress/i.test(msg)) {
        const detailRes = await api.get(`/results/${attemptId}/`).catch(() => null)
        if (detailRes) {
          submittedRef.current = true
          setReviewData(detailRes.data)
        } else {
          setSubmitError(msg)
        }
      } else {
        setSubmitError(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= sortedQuestions.length) return
    setActiveIndex(idx)
    setNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onSelectOption = async (questionId: number, answerId: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answerId }))
    await submitAnswer(questionId, { selected_answer_id: answerId })
  }

  const onShortAnswerChange = (questionId: number, value: string) => {
    setShortAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const persistShortAnswer = async (questionId: number) => {
    await submitAnswer(questionId, { short_answer: (shortAnswers[questionId] || '').trim() || null })
  }

  const onBooleanAnswerChange = async (questionId: number, value: boolean) => {
    setBooleanAnswers((prev) => ({ ...prev, [questionId]: value }))
    await submitAnswer(questionId, { boolean_answer: value })
  }

  // Keyboard shortcuts: ←/→ navigate, F flags, 1-9 pick an option.
  useEffect(() => {
    if (reviewData) return

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable

      if (showSubmitConfirm) {
        if (e.key === 'Escape') setShowSubmitConfirm(false)
        if (e.key === 'Enter') { e.preventDefault(); setShowSubmitConfirm(false); void submitExam() }
        return
      }
      if (typing) return
      if (e.key === 'Escape' && navOpen) { setNavOpen(false); return }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          goTo(activeIndex + 1)
          break
        case 'ArrowLeft':
          e.preventDefault()
          goTo(activeIndex - 1)
          break
        case 'f':
        case 'F':
          e.preventDefault()
          toggleFlag(activeQuestion?.id)
          break
        default:
          if (activeQuestion && /^[1-9]$/.test(e.key)) {
            const opts = activeQuestion.answers
            const idx = Number(e.key) - 1
            if (opts && idx < opts.length) void onSelectOption(activeQuestion.id, opts[idx].id)
          }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeQuestion, sortedQuestions, showSubmitConfirm, navOpen, reviewData])

  const timerTone =
    remainingSeconds === null
      ? 'ok'
      : remainingSeconds <= 60
        ? 'critical'
        : remainingSeconds <= 180
          ? 'warning'
          : 'ok'

  const progressPct = sortedQuestions.length > 0 ? (answeredCount / sortedQuestions.length) * 100 : 0

  const renderNavigator = () => {
    const filters: { key: NavFilter; label: string }[] = [
      { key: 'all', label: 'All' },
      { key: 'unanswered', label: 'Unanswered' },
      { key: 'answered', label: 'Answered' },
      { key: 'flagged', label: 'Flagged' },
    ]
    const countFor = (key: NavFilter) =>
      key === 'all' ? sortedQuestions.length
      : key === 'answered' ? answeredCount
      : key === 'unanswered' ? unansweredCount
      : flaggedQuestions.size

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Questions</h3>
          <span className="text-xs text-slate-500">{answeredCount}/{sortedQuestions.length} answered</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setNavFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                navFilter === f.key
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label} <span className="opacity-70">{countFor(f.key)}</span>
            </button>
          ))}
        </div>

        {filteredQuestions.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No questions match this filter.</p>
        ) : (
          <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-6 gap-2">
            {filteredQuestions.map((q) => {
              const idx = indexById.get(q.id) ?? 0
              const isActive = idx === activeIndex
              const answered = isQuestionAnswered(q)
              const flagged = flaggedQuestions.has(q.id)
              const stateClass = isActive
                ? 'border-primary-600 bg-primary-50 text-primary-700 ring-2 ring-primary-400/40'
                : flagged
                  ? 'border-warning-400 bg-warning-50 text-warning-700'
                  : answered
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-700'
              return (
                <button
                  key={q.id}
                  onClick={() => goTo(idx)}
                  title={`Question ${idx + 1}${flagged ? ' (flagged)' : ''}`}
                  className={`h-10 rounded-lg text-sm font-semibold border transition-colors hover:opacity-90 ${stateClass}`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        )}

        {flaggedQuestions.size > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {flaggedQuestions.size} question(s) flagged for review.
          </p>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load exam</h3>
        <p className="text-gray-500">{error}</p>
        <div className="mt-4">
          <button className="btn-outline" onClick={fetchExamAndQuestions}>Retry</button>
        </div>
      </div>
    )
  }

  if (reviewData) {
    const correctCount = reviewData.answers.filter(a => a.is_correct).length
    const answersById = new Map(reviewData.answers.map(a => [a.question_id, a]))
    return (
      <div data-exam-theme={isDark ? 'dark' : 'light'} className="min-h-screen bg-gradient-to-b from-slate-50 to-white -m-6">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 text-white flex items-center justify-center shrink-0 shadow-sm shadow-primary-600/20">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-primary-600 uppercase tracking-widest mb-0.5">
                  Exam Report
                </div>
                <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-snug truncate">
                  {reviewData.exam_title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                  {exam.category?.name && (
                    <span className="inline-flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                      {exam.category.name}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                    Submitted {formatReviewDate(reviewData.submitted_at)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDark(v => !v)}
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                title="Toggle theme"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={onExit}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
              >
                Done
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 max-w-3xl mx-auto">
          <StudentEncouragement
            variant={reviewData.is_passed ? 'success' : 'neutral'}
            className="mb-6"
            message={
              reviewData.is_passed
                ? `Well done, ${user?.first_name?.trim() || user?.username || 'champion'}! Your result reflects the effort you put in.`
                : `Don't be discouraged, ${user?.first_name?.trim() || user?.username || 'champion'} — this is not the end. Review your answers, learn, and come back stronger.`
            }
          />

          {exam.show_score && (
            <div className={`card mb-6 ${reviewData.is_passed ? 'border-green-200' : 'border-red-200'}`}>
              <div className="card-content text-center">
                <div className="text-sm text-gray-500 mb-1">Your Score</div>
                <div className={`text-5xl font-extrabold ${reviewData.is_passed ? 'text-green-600' : 'text-red-600'}`}>
                  {reviewData.percentage?.toFixed(1) ?? '--'}%
                </div>
                <div className="mt-3 flex items-center justify-center gap-4 text-sm">
                  <span className={`rounded-full px-3 py-1 font-semibold ${reviewData.is_passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {reviewData.is_passed ? 'PASSED' : 'FAILED'}
                  </span>
                  {reviewData.grade && <span className="text-gray-500">Grade: {reviewData.grade}</span>}
                </div>
                <div className="mt-3 text-sm text-gray-500">
                  {correctCount}/{sortedQuestions.length} questions correct · {reviewData.total_marks} mark(s)
                </div>
              </div>
            </div>
          )}

          {exam.allow_review && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Review Answers</h3>
              {sortedQuestions.map((q, idx) => {
                const ans = answersById.get(q.id)
                return (
                  <div key={q.id} className="card">
                    <div className="card-content">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">
                          <span>{idx + 1}. </span>
                          <QuestionBody questionText={q.question_text} latexContent={q.latex_content} questionType={q.question_type} />
                        </div>
                        <span className={`text-xs font-semibold rounded-full px-2 py-1 whitespace-nowrap ${ans?.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {ans?.is_correct ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm">
                        <div className="text-gray-500">Your answer:</div>
                        <div className="mt-1 text-gray-900">
                          {ans?.selected_answer_text
                            ? <MathQuestionRenderer questionText={ans.selected_answer_text} questionType={q.question_type} />
                            : 'No answer'}
                        </div>
                        {ans?.correct_answer_text && (
                          <div className="mt-2 text-green-700">Correct answer: <MathQuestionRenderer questionText={ans.correct_answer_text} questionType={q.question_type} /></div>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-400">Marks: {ans?.marks_obtained ?? 0} / {q.marks}</div>
                    </div>
                  </div>
                )
              })}
              <div className="pt-4 flex justify-center">
                <button
                  onClick={onExit}
                  className="inline-flex items-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}

          {!exam.show_score && !exam.allow_review && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Your exam has been submitted.</p>
              <div className="mt-4">
                <button
                  onClick={onExit}
                  className="inline-flex items-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!exam || sortedQuestions.length === 0 || !activeQuestion) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No questions found</h3>
        <p className="text-gray-500">This exam has no questions available.</p>
        <div className="mt-4">
          <button className="btn-outline" onClick={onExit}>Back</button>
        </div>
      </div>
    )
  }

  const currentSelected = selectedAnswers[activeQuestion.id] || null
  const currentBoolean = booleanAnswers[activeQuestion.id] !== null && booleanAnswers[activeQuestion.id] !== undefined ? booleanAnswers[activeQuestion.id] : null
  const currentFlagged = flaggedQuestions.has(activeQuestion.id)
  const activeHasOptions = !!activeQuestion.answers?.length

  return (
    <div
      data-exam-theme={isDark ? 'dark' : 'light'}
      className="min-h-screen bg-gradient-to-b from-slate-50 to-white -m-6 transition-colors"
    >
      {/* ── Top progress bar ─────────────────────────────────── */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-primary-600 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Minimal header ───────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Exit
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm sm:text-base font-bold text-slate-900 truncate">{exam.title}</div>
              <div className="hidden sm:block text-xs text-slate-500 truncate">{exam.category?.code} · {exam.category?.name} · Attempt #{attemptId}</div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Autosave indicator */}
              <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-500">
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    All changes saved
                  </>
                )}
              </div>

              {/* Countdown */}
              <div className={`rounded-xl border px-3 py-2 tabular-nums ${
                timerTone === 'critical'
                  ? 'border-red-300 bg-red-50 text-red-700 animate-pulse'
                  : timerTone === 'warning'
                    ? 'border-warning-300 bg-warning-50 text-warning-700'
                    : 'border-slate-200 bg-white text-slate-900'
              }`}>
                <div className="flex items-center text-sm font-bold">
                  <Clock className="h-4 w-4 mr-2" />
                  {remainingSeconds === null ? '--:--' : formatRemaining(remainingSeconds)}
                </div>
                <div className="text-[11px] text-slate-500">Time remaining</div>
              </div>

              {/* Theme toggle */}
              <button
                onClick={() => setIsDark(v => !v)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                title="Toggle low-glare mode"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="inline-flex items-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Flag className="h-4 w-4 mr-2" />}
                Submit
              </button>
            </div>
          </div>

          {submitError ? <div className="mt-3 text-sm text-red-600">{submitError}</div> : null}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6">
        <StudentEncouragement
          variant="compact"
          className="mb-6"
          heading={`All the best, ${user?.first_name?.trim() || user?.username || 'champion'}!`}
          message="Read each question carefully, stay calm, and trust yourself. You have prepared for this moment."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Question card ─────────────────────────────────── */}
          <div className="lg:col-span-8">
            <div className="card">
              <div className="card-content space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-500">Question {activeIndex + 1} of {sortedQuestions.length}</div>

                    {/* Comprehension Passage */}
                    {activeQuestion.comprehension_passage && (
                      <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-sm font-medium text-blue-800 mb-2">Comprehension Passage:</div>
                        <div className="text-sm text-gray-800 leading-relaxed">
                          <MathQuestionRenderer questionText={activeQuestion.comprehension_passage} questionType={activeQuestion.question_type} />
                        </div>
                      </div>
                    )}

                    {/* Shared Comprehension Passage (for questions in same group) */}
                    {!activeQuestion.comprehension_passage && activeQuestion.comprehension_group && (() => {
                      // Find shared passage from other questions in the same group
                      const sharedPassage = sortedQuestions.find(q =>
                        q.comprehension_group === activeQuestion.comprehension_group &&
                        q.comprehension_passage
                      )?.comprehension_passage

                      return sharedPassage ? (
                        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="text-sm font-medium text-blue-800 mb-2">Comprehension Passage:</div>
                          <div className="text-sm text-gray-800 leading-relaxed">
                            <MathQuestionRenderer questionText={sharedPassage} questionType={activeQuestion.question_type} />
                          </div>
                        </div>
                      ) : null
                    })()}

                    {/* Question Text with Math/Science Support */}
                    <div className="mt-2 text-base sm:text-lg font-semibold text-gray-900 leading-relaxed">
                      <QuestionBody
                        questionText={activeQuestion.question_text}
                        latexContent={activeQuestion.latex_content}
                        questionType={activeQuestion.question_type}
                      />
                    </div>

                    {/* Shared Image */}
                    {activeQuestion.shared_image && (
                      <div className="mt-3">
                        <div className="text-sm text-gray-600 mb-2">Refer to the following image:</div>
                        <img
                          src={activeQuestion.shared_image.image}
                          alt={activeQuestion.shared_image.title || "Shared image"}
                          className="max-w-full h-auto rounded-lg border border-gray-200"
                        />
                        {activeQuestion.shared_image.caption && (
                          <div className="text-xs text-gray-500 mt-1 italic">
                            {activeQuestion.shared_image.caption}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Diagram for Physics/Science Questions */}
                    {activeQuestion.diagram_image && (
                      <div className="mt-3">
                        <img
                          src={activeQuestion.diagram_image}
                          alt="Question diagram"
                          className="max-w-full h-auto rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-gray-500 whitespace-nowrap">{activeQuestion.marks} mark(s)</span>
                    <button
                      onClick={() => toggleFlag(activeQuestion.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        currentFlagged
                          ? 'bg-warning-50 border-warning-400 text-warning-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                      title="Flag for review (F)"
                    >
                      <Flag className={`w-3.5 h-3.5 ${currentFlagged ? 'fill-warning-400 text-warning-600' : ''}`} />
                      {currentFlagged ? 'Flagged' : 'Flag'}
                    </button>
                  </div>
                </div>

                {/* Multiple Choice Questions */}
                {activeQuestion.question_type === 'multiple' && (
                  <div className="space-y-2">
                    {activeQuestion.answers
                      .slice()
                      .map((a, i) => {
                        const selected = currentSelected === a.id
                        return (
                          <button
                            key={a.id}
                            onClick={() => void onSelectOption(activeQuestion.id, a.id)}
                            className={`w-full text-left p-4 rounded-xl border transition-colors ${
                              selected
                                ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-400'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                            disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <span className={`mt-0.5 h-6 w-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold ${
                                  selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white text-gray-500'
                                }`}>
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <div className="text-sm text-gray-900 pt-0.5"><MathQuestionRenderer questionText={a.answer_text} questionType={activeQuestion.question_type} /></div>
                              </div>
                              <div className="text-xs text-gray-400">Option {a.order}</div>
                            </div>
                          </button>
                        )
                      })}
                  </div>
                )}

                {/* True/False Questions */}
                {activeQuestion.question_type === 'true_false' && (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 mb-2">Select True or False:</div>
                    <div className="flex gap-4">
                      <button
                        onClick={() => void onBooleanAnswerChange(activeQuestion.id, true)}
                        className={`flex-1 p-4 rounded-xl border transition-colors ${
                          currentBoolean === true
                            ? 'border-green-400 bg-green-50 ring-1 ring-green-400'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                        disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                            currentBoolean === true ? 'border-green-600 bg-green-600' : 'border-gray-300 bg-white'
                          }`}>
                            {currentBoolean === true && <Check className="h-3 w-3 text-white" />}
                          </span>
                          <span className="text-sm font-medium text-gray-900">TRUE</span>
                        </div>
                      </button>
                      <button
                        onClick={() => void onBooleanAnswerChange(activeQuestion.id, false)}
                        className={`flex-1 p-4 rounded-xl border transition-colors ${
                          currentBoolean === false
                            ? 'border-red-400 bg-red-50 ring-1 ring-red-400'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                        disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                            currentBoolean === false ? 'border-red-600 bg-red-600' : 'border-gray-300 bg-white'
                          }`}>
                            {currentBoolean === false && <X className="h-3 w-3 text-white" />}
                          </span>
                          <span className="text-sm font-medium text-gray-900">FALSE</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Fill in the Blank Questions */}
                {activeQuestion.question_type === 'fill_blank' && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Fill in the blank:</div>
                    <input
                      type="text"
                      value={shortAnswers[activeQuestion.id] || ''}
                      onChange={(e) => onShortAnswerChange(activeQuestion.id, e.target.value)}
                      onBlur={() => void persistShortAnswer(activeQuestion.id)}
                      className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white text-gray-900"
                      placeholder="Enter your answer..."
                      disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                    />
                  </div>
                )}

                {/* Math Questions */}
                {activeQuestion.question_type === 'math' && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Mathematical Answer:</div>
                    <MathInput
                      value={shortAnswers[activeQuestion.id] || ''}
                      onChange={(value) => onShortAnswerChange(activeQuestion.id, value)}
                      onBlur={() => void persistShortAnswer(activeQuestion.id)}
                      placeholder="Enter your mathematical answer (supports LaTeX: x^2, \frac{a}{b}, \sqrt{x})"
                      disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                    />
                  </div>
                )}

                {/* Chemistry Questions */}
                {activeQuestion.question_type === 'chemistry' && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Chemical Equation:</div>
                    <ChemInput
                      value={shortAnswers[activeQuestion.id] || ''}
                      onChange={(value) => onShortAnswerChange(activeQuestion.id, value)}
                      onBlur={() => void persistShortAnswer(activeQuestion.id)}
                      placeholder="Enter chemical equation (e.g., 2H2 + O2 → 2H2O)"
                      disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                    />
                  </div>
                )}

                {/* Physics Questions */}
                {activeQuestion.question_type === 'physics' && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Physics Answer:</div>
                    <MathInput
                      value={shortAnswers[activeQuestion.id] || ''}
                      onChange={(value) => onShortAnswerChange(activeQuestion.id, value)}
                      onBlur={() => void persistShortAnswer(activeQuestion.id)}
                      placeholder="Enter your answer with units (e.g., 9.8 m/s^2)"
                      disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                    />
                  </div>
                )}

                {/* Short Answer Questions */}
                {activeQuestion.question_type === 'short' && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Type your answer below:</div>
                    <textarea
                      value={shortAnswers[activeQuestion.id] || ''}
                      onChange={(e) => onShortAnswerChange(activeQuestion.id, e.target.value)}
                      onBlur={() => void persistShortAnswer(activeQuestion.id)}
                      rows={5}
                      className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white text-gray-900"
                      placeholder="Enter your answer..."
                      disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                    />
                  </div>
                )}

                {/* Comprehension Questions */}
                {activeQuestion.question_type === 'comprehension' && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Answer based on the comprehension passage above:</div>
                    {activeQuestion.answers && activeQuestion.answers.length > 0 ? (
                      <div className="space-y-2">
                        {activeQuestion.answers
                          .slice()
                          .map((a, i) => {
                            const selected = currentSelected === a.id
                            return (
                              <button
                                key={a.id}
                                onClick={() => void onSelectOption(activeQuestion.id, a.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                                  selected
                                    ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-400'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                                disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <span className={`mt-0.5 h-6 w-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold ${
                                      selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white text-gray-500'
                                    }`}>
                                      {String.fromCharCode(65 + i)}
                                    </span>
                                    <div className="text-sm text-gray-900 pt-0.5"><MathQuestionRenderer questionText={a.answer_text} questionType={activeQuestion.question_type} /></div>
                                  </div>
                                  <div className="text-xs text-gray-400">Option {a.order}</div>
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    ) : (
                      <textarea
                        value={shortAnswers[activeQuestion.id] || ''}
                        onChange={(e) => onShortAnswerChange(activeQuestion.id, e.target.value)}
                        onBlur={() => void persistShortAnswer(activeQuestion.id)}
                        rows={4}
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white text-gray-900"
                        placeholder="Enter your answer based on the passage..."
                        disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                      />
                    )}
                  </div>
                )}

                {/* Biology Questions */}
                {activeQuestion.question_type === 'biology' && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">
                      {activeQuestion.answers && activeQuestion.answers.length > 0
                        ? "Select the correct answer based on the diagram/image:"
                        : "Type your answer based on the diagram/image:"}
                    </div>
                    {activeQuestion.answers && activeQuestion.answers.length > 0 ? (
                      <div className="space-y-2">
                        {activeQuestion.answers
                          .slice()
                          .map((a, i) => {
                            const selected = currentSelected === a.id
                            return (
                              <button
                                key={a.id}
                                onClick={() => void onSelectOption(activeQuestion.id, a.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                                  selected
                                    ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-400'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                                disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <span className={`mt-0.5 h-6 w-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold ${
                                      selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white text-gray-500'
                                    }`}>
                                      {String.fromCharCode(65 + i)}
                                    </span>
                                    <div className="text-sm text-gray-900 pt-0.5"><MathQuestionRenderer questionText={a.answer_text} questionType={activeQuestion.question_type} /></div>
                                  </div>
                                  <div className="text-xs text-gray-400">Option {a.order}</div>
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    ) : (
                      <textarea
                        value={shortAnswers[activeQuestion.id] || ''}
                        onChange={(e) => onShortAnswerChange(activeQuestion.id, e.target.value)}
                        onBlur={() => void persistShortAnswer(activeQuestion.id)}
                        rows={4}
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white text-gray-900"
                        placeholder="Enter your answer based on the diagram..."
                        disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                      />
                    )}
                  </div>
                )}

                {/* Bottom navigation */}
                <div className="flex items-center justify-between pt-2 gap-3">
                  <button
                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                    onClick={() => goTo(activeIndex - 1)}
                    disabled={activeIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1.5" />
                    Previous
                  </button>

                  <button
                    onClick={() => toggleFlag(activeQuestion.id)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      currentFlagged
                        ? 'bg-warning-50 border-warning-400 text-warning-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Flag className={`w-4 h-4 ${currentFlagged ? 'fill-warning-400 text-warning-600' : ''}`} />
                    {currentFlagged ? 'Flagged' : 'Flag'}
                  </button>

                  <button
                    className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                    onClick={() => goTo(activeIndex + 1)}
                    disabled={activeIndex === sortedQuestions.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Question navigator (desktop) ──────────────────── */}
          <div className="hidden lg:col-span-4 lg:block">
            <div className="card">
              <div className="card-content">
                {renderNavigator()}
              </div>
            </div>

            {savingQuestionIds.size > 0 ? (
              <div className="mt-4 text-sm text-gray-500 flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Mobile question drawer trigger ───────────────────── */}
      <div className="fixed bottom-4 right-4 lg:hidden z-30">
        <button
          onClick={() => setNavOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-3 shadow-lg"
        >
          <LayoutGrid className="h-4 w-4" />
          Questions · {activeIndex + 1}/{sortedQuestions.length}
          {unansweredCount > 0 && (
            <span className="rounded-full bg-warning-400 text-slate-900 text-[11px] font-bold px-2 py-0.5">
              {unansweredCount} left
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile question drawer ────────────────────────────── */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl animate-fade-in overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-slate-900">Question Navigator</span>
              <button
                onClick={() => setNavOpen(false)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNavigator()}
          </div>
        </div>
      )}

      {/* ── Submit confirmation modal ─────────────────────────── */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-scale-in overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                  unansweredCount > 0 ? 'bg-warning-50' : 'bg-green-50'
                }`}>
                  <Flag className={`h-5 w-5 ${unansweredCount > 0 ? 'text-warning-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Submit exam?</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {unansweredCount > 0
                      ? `You still have ${unansweredCount} unanswered question(s). Once submitted, you cannot change your answers.`
                      : 'You have answered all questions. Once submitted, you cannot change your answers.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-lg font-bold text-slate-900">{answeredCount}</div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-wide">Answered</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className={`text-lg font-bold ${unansweredCount > 0 ? 'text-warning-600' : 'text-slate-900'}`}>{unansweredCount}</div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-wide">Unanswered</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-lg font-bold text-slate-900">{flaggedQuestions.size}</div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-wide">Flagged</div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50"
                >
                  Keep Working
                </button>
                <button
                  onClick={() => { setShowSubmitConfirm(false); void submitExam() }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-sm shadow-primary-600/20"
                >
                  Submit Exam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Proctoring / security (runs silently) ─────────────── */}
      <TabSwitchDetector
        examId={examId}
        attemptId={attemptId}
        token={token}
        isActive={!isSubmitting && exam && sortedQuestions.length > 0}
        onViolation={() => {
          toast.error('Tab switching is prohibited. Your exam has been submitted.')
          void submitExam()
        }}
      />

      <ScreenRecorder
        examId={examId}
        attemptId={attemptId}
        token={token}
        isActive={!isSubmitting && exam && sortedQuestions.length > 0}
      />

      <WebcamMonitor
        examId={examId}
        attemptId={attemptId}
        token={token}
        isActive={!isSubmitting && exam && sortedQuestions.length > 0}
      />

      <SessionSecurity
        examId={examId}
        attemptId={attemptId}
        token={token}
        isActive={!isSubmitting && exam && sortedQuestions.length > 0}
      />
    </div>
  )
}
