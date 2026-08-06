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
  category: {
    id: number
    code: string
    name: string
    description?: string | null
  }
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
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const endTimeMsRef = useRef<number | null>(null)

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
    const endMs = existing ? Number(existing) : (typeof endTimeMs === 'number' ? endTimeMs : Date.now() + durationMs)

    endTimeMsRef.current = endMs
    if (!existing) window.localStorage.setItem(key, String(endMs))

    const tick = () => {
      const endTimeMs = endTimeMsRef.current
      if (!endTimeMs) return
      const left = Math.ceil((endTimeMs - Date.now()) / 1000)
      setRemainingSeconds(left)
      if (left <= 0) {
        void submitExam(true)
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

      const [examRes, qRes] = await Promise.all([
        api.get(`/exams/${examId}/`),
        api.get(`/exams/${examId}/questions/`),
      ])

      setExam(examRes.data)
      setQuestions(qRes.data || [])
      setActiveIndex(0)
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

  const submitAnswer = async (questionId: number, payload: { selected_answer_id?: number | null; short_answer?: string | null; boolean_answer?: boolean | null }) => {
    try {
      setSavingQuestionId(questionId)
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
      setSavingQuestionId(null)
    }
  }

  const submitExam = async (isAuto: boolean) => {
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

      if (isAuto) {
        onExit()
        return
      }

      onExit()
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
                  if (window.confirm('Submit exam now?')) void submitExam(false)
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
                      .sort((a, b) => a.order - b.order)
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
                            disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                        disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                        disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                      disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                      disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                      disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                      disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                      disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                          .sort((a, b) => a.order - b.order)
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
                                disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                        disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                          .sort((a, b) => a.order - b.order)
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
                                disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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
                        disabled={savingQuestionId === activeQuestion.id || isSubmitting}
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

            {savingQuestionId ? (
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
          void submitExam(true)
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
