'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Clock, Users, Play, Edit3 } from 'lucide-react'
import api from '@/utils/axios'
import { useAuth } from '@/contexts/AuthContext'

interface Exam {
  id: number
  title: string
  category: {
    name: string
  }
  description: string
  duration_minutes: number
  total_questions: number
  status: string
  start_date: string
  end_date: string
}

interface ExamsListProps {
  onExamStarted?: (examId: number, attemptId: number) => void
  onEditExam?: (examId: number) => void
}

export default function ExamsList({ onExamStarted, onEditExam }: ExamsListProps) {
  const { token, user } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetchExams()
  }, [token])

  const fetchExams = async () => {
    try {
      setError(null)
      const response = await api.get(`/exams/`)
      setExams(response.data)
    } catch (error) {
      console.error('Failed to fetch exams:', error)
      setError('Failed to load exams. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const startExam = async (examId: number) => {
    try {
      const response = await api.post(
        `/results/start/?exam_id=${examId}`,
        {}
      )
      const attemptId = response.data?.id
      if (typeof attemptId === 'number' && onExamStarted) {
        onExamStarted(examId, attemptId)
      }
    } catch (error) {
      console.error('Failed to start exam:', error)
    }
  }

  const filteredExams = exams.filter(exam => {
    if (filter === 'all') return true
    return exam.status === filter
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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
        <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load exams</h3>
        <p className="text-gray-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Available Exams</h1>
          <p className="text-lg text-gray-600">
            {showAll ? "All exams in the system" : "Exams available for you"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className="btn btn-outline"
          >
            {showAll ? "Show Available" : "Show All"}
          </button>
          {user?.is_superuser && (
            <button
              onClick={() => window.location.href = '/admin'}
              className="btn btn-primary"
            >
              Admin Panel
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex space-x-2">
        {['all', 'active', 'draft', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Exams Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredExams.map((exam: any) => (
          <div
            key={exam.id}
            className="card bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900 leading-tight">
                  {exam.title}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(exam.status)}`}>
                  {exam.status}
                </span>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {exam.category?.name || 'Uncategorized'}
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {exam.duration_minutes} minutes
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {exam.total_questions} questions
                </div>
                
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Pass: {exam.passing_score}%
                </div>
              </div>
              
              <div className="text-sm text-gray-500 mb-6">
                {new Date(exam.start_date).toLocaleDateString()} - {new Date(exam.end_date).toLocaleDateString()}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => startExam(exam.id)}
                  disabled={exam.status !== 'active'}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                    exam.status === 'active'
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {exam.status === 'active' ? 'Start Exam' : 'Not Available'}
                </button>
                {user?.is_superuser && (
                  <button
                    onClick={() => onEditExam?.(exam.id)}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                    title="Edit Exam"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredExams.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No exams found</h3>
          <p className="text-gray-500">
            {filter === 'all' 
              ? "No exams are available at the moment." 
              : `No ${filter} exams found.`}
          </p>
        </div>
      )}
    </div>
  )
}
