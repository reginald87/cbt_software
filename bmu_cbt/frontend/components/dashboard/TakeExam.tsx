'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import api from '@/utils/axios'
import { BookOpen, ChevronLeft, Clock, Flag, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import TabSwitchDetector from './TabSwitchDetector'
import ScreenRecorder from './ScreenRecorder'
import WebcamMonitor from './WebcamMonitor'
import SessionSecurity from './SessionSecurity'
import MathQuestionRenderer, { MathInput, ChemInput } from './MathQuestionRenderer'
import KaTeXRenderer from './KaTeXRenderer'
import Image from 'next/image'

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

function formatRemaining(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
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
  const [savingQuestionIds, setSavingQuestionIds] = useState<Set<number>>(new Set())
  const saveQueuesRef = useRef<Record<number, Promise<void>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const endTimeMsRef = useRef<number | null>(null)
  const serverTimeOffsetRef = useRef<number>(0)
  const [reviewData, setReviewData] = useState<AttemptDetail | null>(null)
  const submittedRef = useRef(false)

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
        api.get(`/exams/${examId}/questions/`),
        api.get(`/results/${attemptId}/`).catch(() => null),
      ])

      const serverTime = examRes.data?.server_time
      if (serverTime) {
        serverTimeOffsetRef.current = new Date(serverTime).getTime() - Date.now()
      }

      setExam(examRes.data)
      setQuestions(qRes.data || [])
      setActiveIndex(0)

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

  const answeredCount = useMemo(() => {
    let count = 0
    for (const q of sortedQuestions) {
      if (q.question_type === 'multiple') {
        if (selectedAnswers[q.id]) count += 1
      } else if (q.question_type === 'true_false') {
        if (booleanAnswers[q.id] !== null && booleanAnswers[q.id] !== undefined) count += 1
      } else if (q.question_type === 'fill_blank') {
        if ((shortAnswers[q.id] || '').trim()) count += 1
      } else if (q.question_type === 'short') {
        if ((shortAnswers[q.id] || '').trim()) count += 1
      }
    }
    return count
  }, [sortedQuestions, selectedAnswers, shortAnswers, booleanAnswers])

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
    if (isSubmitting) return
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
      setSubmitError(e.response?.data?.detail || 'Failed to submit exam')
    } finally {
      setIsSubmitting(false)
    }
  }

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= sortedQuestions.length) return
    setActiveIndex(idx)
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white -m-6">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="px-6 py-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold text-slate-900 truncate">{reviewData.exam_title}</div>
              <div className="text-xs text-slate-500">Exam completed · Attempt #{attemptId}</div>
            </div>
            <button
              onClick={onExit}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
            >
              Done
            </button>
          </div>
        </div>

        <div className="px-6 py-6 max-w-3xl mx-auto">
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
                          <MathQuestionRenderer questionText={q.latex_content || q.question_text} questionType={q.question_type} />
                        </div>
                        <span className={`text-xs font-semibold rounded-full px-2 py-1 whitespace-nowrap ${ans?.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {ans?.is_correct ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm">
                        <div className="text-gray-500">Your answer:</div>
                        <div className="mt-1 text-gray-900">{ans?.selected_answer_text || 'No answer'}</div>
                        {ans?.correct_answer_text && (
                          <div className="mt-2 text-green-700">Correct answer: {ans.correct_answer_text}</div>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white -m-6">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="px-6 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={onExit}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Exit
                </button>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-bold text-slate-900 truncate">{exam.title}</div>
                  <div className="text-xs text-slate-500 truncate">{exam.category?.code} · {exam.category?.name} · Attempt #{attemptId}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="text-[11px] text-slate-500">Progress</div>
                <div className="text-sm font-bold text-slate-900">{answeredCount}/{sortedQuestions.length}</div>
              </div>

              <div className={`rounded-xl border px-3 py-2 ${remainingSeconds !== null && remainingSeconds <= 60 ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center text-sm font-bold text-slate-900">
                  <Clock className="h-4 w-4 mr-2" />
                  {remainingSeconds === null ? '--:--' : formatRemaining(remainingSeconds)}
                </div>
                <div className="text-[11px] text-slate-500">Time remaining</div>
              </div>

              {user && (
                <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  {user.profile_picture ? (
                    <div className="relative h-8 w-8 overflow-hidden rounded-full border border-slate-200">
                      <Image
                        src={user.profile_picture}
                        alt={user.full_name || user.username}
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-xs font-semibold text-slate-700">
                        {(user.first_name?.[0] || user.username?.[0] || 'U').toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {user.first_name || user.username}
                    </div>
                    <div className="text-[11px] text-slate-500">{user.matric_number || user.jamb_number || 'No ID'}</div>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (window.confirm('Submit exam now?')) void submitExam()
                }}
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

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <div className="card">
              <div className="card-content space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
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
                    <div className="mt-2 text-base font-semibold text-gray-900">
                      <MathQuestionRenderer 
                        questionText={activeQuestion.latex_content || activeQuestion.question_text} 
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
                  <div className="text-xs text-gray-500 whitespace-nowrap">{activeQuestion.marks} mark(s)</div>
                </div>

                {/* Multiple Choice Questions */}
                {activeQuestion.question_type === 'multiple' && (
                  <div className="space-y-2">
                    {activeQuestion.answers
                      .slice()
                      .map((a) => {
                        const selected = currentSelected === a.id
                        return (
                          <button
                            key={a.id}
                            onClick={() => void onSelectOption(activeQuestion.id, a.id)}
                            className={`w-full text-left p-4 rounded-xl border transition-colors ${
                              selected
                                ? 'border-primary-400 bg-primary-50'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                            disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${selected ? 'border-primary-600 bg-primary-600' : 'border-gray-300 bg-white'}`}>
                                  <div className={`h-2 w-2 rounded-full ${selected ? 'bg-white' : 'bg-transparent'}`} />
                                </div>
                                <div className="text-sm text-gray-900">{a.answer_text}</div>
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
                            ? 'border-green-400 bg-green-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                        disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                            currentBoolean === true ? 'border-green-600 bg-green-600' : 'border-gray-300 bg-white'
                          }`}>
                            <div className={`h-2 w-2 rounded-full ${currentBoolean === true ? 'bg-white' : 'bg-transparent'}`} />
                          </div>
                          <span className="text-sm font-medium text-gray-900">TRUE</span>
                        </div>
                      </button>
                      <button
                        onClick={() => void onBooleanAnswerChange(activeQuestion.id, false)}
                        className={`flex-1 p-4 rounded-xl border transition-colors ${
                          currentBoolean === false
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                        disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                            currentBoolean === false ? 'border-red-600 bg-red-600' : 'border-gray-300 bg-white'
                          }`}>
                            <div className={`h-2 w-2 rounded-full ${currentBoolean === false ? 'bg-white' : 'bg-transparent'}`} />
                          </div>
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
                      className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
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
                      className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
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
                          .map((a) => {
                            const selected = currentSelected === a.id
                            return (
                              <button
                                key={a.id}
                                onClick={() => void onSelectOption(activeQuestion.id, a.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                                  selected
                                    ? 'border-primary-400 bg-primary-50'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                                disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${
                                      selected ? 'border-primary-600 bg-primary-600' : 'border-gray-300 bg-white'
                                    }`}>
                                      <div className={`h-2 w-2 rounded-full ${selected ? 'bg-white' : 'bg-transparent'}`} />
                                    </div>
                                    <div className="text-sm text-gray-900">{a.answer_text}</div>
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
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
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
                          .map((a) => {
                            const selected = currentSelected === a.id
                            return (
                              <button
                                key={a.id}
                                onClick={() => void onSelectOption(activeQuestion.id, a.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                                  selected
                                    ? 'border-primary-400 bg-primary-50'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                                }`}
                                disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${
                                      selected ? 'border-primary-600 bg-primary-600' : 'border-gray-300 bg-white'
                                    }`}>
                                      <div className={`h-2 w-2 rounded-full ${selected ? 'bg-white' : 'bg-transparent'}`} />
                                    </div>
                                    <div className="text-sm text-gray-900">{a.answer_text}</div>
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
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                        placeholder="Enter your answer based on the diagram..."
                        disabled={savingQuestionIds.has(activeQuestion.id) || isSubmitting}
                      />
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => goTo(activeIndex - 1)}
                    disabled={activeIndex === 0}
                  >
                    Previous
                  </button>
                  <button
                    className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                    onClick={() => goTo(activeIndex + 1)}
                    disabled={activeIndex === sortedQuestions.length - 1}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Questions</h3>
              </div>
              <div className="card-content">
                <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-6 gap-2">
                  {sortedQuestions.map((q, idx) => {
                    const isQShort = !q.answers?.length
                    const isAnswered = isQShort ? !!(shortAnswers[q.id] || '').trim() : !!selectedAnswers[q.id]
                    const isActive = idx === activeIndex
                    return (
                      <button
                        key={q.id}
                        onClick={() => goTo(idx)}
                        className={`h-10 rounded-lg text-sm font-semibold border transition-colors ${
                          isActive
                            ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : isAnswered
                              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  <div className="flex items-center justify-between">
                    <span>Answered</span>
                    <span className="font-semibold text-gray-900">{answeredCount}/{sortedQuestions.length}</span>
                  </div>
                </div>
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
      
      {/* Tab Switch Detector for Security */}
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
      
      {/* Screen Recorder for Proctoring */}
      <ScreenRecorder 
        examId={examId} 
        attemptId={attemptId} 
        token={token}
        isActive={!isSubmitting && exam && sortedQuestions.length > 0}
      />
      
      {/* Webcam Monitor for Proctoring */}
      <WebcamMonitor 
        examId={examId} 
        attemptId={attemptId} 
        token={token}
        isActive={!isSubmitting && exam && sortedQuestions.length > 0}
      />
      
      {/* Session Security Monitoring */}
      <SessionSecurity 
        examId={examId} 
        attemptId={attemptId} 
        token={token}
        isActive={!isSubmitting && exam && sortedQuestions.length > 0}
      />
    </div>
  )
}
