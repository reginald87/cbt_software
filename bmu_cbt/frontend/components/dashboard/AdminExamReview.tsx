'use client'

import { useEffect, useMemo, useState } from 'react'
import api from '@/utils/axios'
import { BookOpen, CheckCircle, Eye, RefreshCcw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import MathQuestionRenderer, { QuestionBody } from './MathQuestionRenderer'

interface ExamListItem {
  id: number
  title: string
  description?: string
  duration_minutes: number
  total_questions: number
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

interface AdminAnswer {
  id: number
  answer_text: string
  order: number
  is_correct: boolean
}

interface AdminQuestion {
  id: number
  question_text: string
  question_type: string
  marks: number
  order: number
  explanation?: string | null
  latex_content?: string | null
  answers: AdminAnswer[]
}

interface AdminExamDetail {
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
  questions: AdminQuestion[]
}

export default function AdminExamReview() {
  const { token, user } = useAuth()
  const [draftExams, setDraftExams] = useState<ExamListItem[]>([])
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null)
  const [selectedExam, setSelectedExam] = useState<AdminExamDetail | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  if (!user?.is_superuser) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access denied</h3>
        <p className="text-gray-500">Admin privileges are required to review and publish exams.</p>
      </div>
    )
  }

  const selectedListItem = useMemo(
    () => draftExams.find(e => e.id === selectedExamId) || null,
    [draftExams, selectedExamId]
  )

  useEffect(() => {
    if (!token) return
    fetchDrafts()
  }, [token])

  useEffect(() => {
    if (!token) return
    if (!selectedExamId) {
      setSelectedExam(null)
      return
    }
    fetchExamDetail(selectedExamId)
  }, [token, selectedExamId])

  const fetchDrafts = async () => {
    try {
      setIsLoadingList(true)
      const res = await api.get(`/exams/`, {
        params: { status: 'draft' },
      })
      setDraftExams(res.data || [])
      if (!selectedExamId && (res.data || []).length > 0) {
        setSelectedExamId(res.data[0].id)
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to load draft exams')
    } finally {
      setIsLoadingList(false)
    }
  }

  const fetchExamDetail = async (examId: number) => {
    try {
      setIsLoadingDetail(true)
      const res = await api.get(`/exams/${examId}/admin-detail/`)
      setSelectedExam(res.data)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load exam details')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const publishExam = async () => {
    if (!selectedExamId) return
    try {
      setIsPublishing(true)
      await api.patch(
        `/exams/${selectedExamId}/status/`,
        { status: 'active' }
      )
      toast.success('Exam published')
      setSelectedExamId(null)
      setSelectedExam(null)
      await fetchDrafts()
    } catch (e: any) {
      console.error(e)
      const msg = e.response?.data?.detail || 'Failed to publish exam'
      toast.error(msg)
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Review Draft Exams</h2>
          <p className="text-gray-600">Check imported exams for correctness, then publish when ready.</p>
        </div>
        <button onClick={fetchDrafts} className="btn-outline flex items-center" disabled={isLoadingList}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Draft Exams</h3>
            </div>
            <div className="card-content">
              {isLoadingList ? (
                <div className="flex items-center justify-center h-40">
                  <div className="loading-spinner w-8 h-8" />
                </div>
              ) : draftExams.length === 0 ? (
                <div className="text-sm text-gray-500">No draft exams to review.</div>
              ) : (
                <div className="space-y-2">
                  {draftExams.map(exam => (
                    <button
                      key={exam.id}
                      onClick={() => setSelectedExamId(exam.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedExamId === exam.id
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{exam.title}</div>
                          <div className="text-xs text-gray-500">{exam.category?.name}</div>
                        </div>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {exam.total_questions} questions · {exam.duration_minutes} min
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="card-title">Preview</h3>
                <button
                  onClick={publishExam}
                  className="btn-primary flex items-center"
                  disabled={!selectedExamId || isPublishing || isLoadingDetail}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isPublishing ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
            <div className="card-content">
              {!selectedExamId ? (
                <div className="text-sm text-gray-500">Select a draft exam to preview.</div>
              ) : isLoadingDetail ? (
                <div className="flex items-center justify-center h-56">
                  <div className="loading-spinner w-8 h-8" />
                </div>
              ) : !selectedExam ? (
                <div className="text-sm text-gray-500">Unable to load exam details.</div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                          <BookOpen className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{selectedExam.title}</h4>
                          <div className="text-sm text-gray-500">{selectedExam.category?.name}</div>
                        </div>
                      </div>
                      {selectedExam.description ? (
                        <p className="mt-3 text-sm text-gray-600">{selectedExam.description}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <div>{selectedExam.total_questions} questions</div>
                      <div>{selectedExam.duration_minutes} minutes</div>
                      <div>Passing: {selectedExam.passing_score}%</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedExam.questions.map(q => (
                      <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="font-medium text-gray-900">
                            {q.order}. <QuestionBody questionText={q.question_text} latexContent={q.latex_content} questionType={q.question_type} />
                          </div>
                          <div className="text-xs text-gray-500">{q.question_type} · {q.marks} marks</div>
                        </div>
                        {q.answers?.length ? (
                          <div className="mt-3 space-y-2">
                            {q.answers.map(a => (
                              <div
                                key={a.id}
                                className={`text-sm p-2 rounded-md border ${
                                  a.is_correct ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                                }`}
                              >
                                <span className="mr-2 text-gray-500">{a.order}.</span>
                                <span className={a.is_correct ? 'font-medium text-green-800' : 'text-gray-800'}>
                                  <MathQuestionRenderer questionText={a.answer_text} questionType={q.question_type} />
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-gray-500">No options (short answer)</div>
                        )}
                        {q.explanation ? (
                          <div className="mt-3 text-xs text-gray-500">Explanation: {q.explanation}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {selectedListItem && selectedListItem.total_questions === 0 ? (
                    <div className="text-sm text-red-600">
                      This exam has 0 questions. You won’t be able to publish it until questions are imported.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
