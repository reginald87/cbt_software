'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Users, TrendingUp, Clock } from 'lucide-react'
import api from '@/utils/axios'
import { useAuth } from '@/contexts/AuthContext'

interface Exam {
  id: number
  title: string
  description?: string
  duration_minutes: number
  total_questions: number
  status: string
  start_date: string
  end_date: string
}

interface ExamAttempt {
  id: number
  exam_id: number
  exam_title: string
  status: string
  percentage: number
  grade: string
  is_passed: boolean
  start_time: string
  submitted_at: string
}

export default function Overview() {
  const { token } = useAuth()
  const [stats, setStats] = useState({
    totalExams: 0,
    completedExams: 0,
    averageScore: 0,
    upcomingExams: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [recentResults, setRecentResults] = useState<ExamAttempt[]>([])
  const [upcomingExams, setUpcomingExams] = useState<Exam[]>([])

  useEffect(() => {
    if (!token) return
    fetchOverviewData()
  }, [token])

  const fetchOverviewData = async () => {
    try {
      const [examsRes, attemptsRes] = await Promise.all([
        api.get(`/exams/`),
        api.get(`/results/attempts/`),
      ])

      const exams: Exam[] = examsRes.data || []
      const attempts: ExamAttempt[] = attemptsRes.data || []

      const completed = attempts.filter(a => a.status === 'graded' || a.status === 'submitted' || !!a.submitted_at)
      const avgScore = completed.length > 0
        ? completed.reduce((sum, a) => sum + (a.percentage || 0), 0) / completed.length
        : 0

      const now = new Date()
      const upcoming = exams
        .filter(e => {
          const start = new Date(e.start_date)
          return start > now && e.status !== 'completed'
        })
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

      setStats({
        totalExams: exams.length,
        completedExams: completed.length,
        averageScore: Number.isFinite(avgScore) ? Number(avgScore.toFixed(1)) : 0,
        upcomingExams: upcoming.length,
      })

      setRecentResults(
        completed
          .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
          .slice(0, 5)
      )

      setUpcomingExams(upcoming.slice(0, 5))
    } catch (error) {
      console.error('Failed to fetch overview data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Total Exams',
      value: stats.totalExams,
      icon: BookOpen,
      color: 'bg-blue-500',
      change: '+2 this month'
    },
    {
      title: 'Completed',
      value: stats.completedExams,
      icon: Users,
      color: 'bg-green-500',
      change: '+1 this week'
    },
    {
      title: 'Average Score',
      value: `${stats.averageScore}%`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      change: '+5% improvement'
    },
    {
      title: 'Upcoming',
      value: stats.upcomingExams,
      icon: Clock,
      color: 'bg-orange-500',
      change: 'Next in 2 days'
    }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-600">Welcome back! Here's your academic progress.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="card">
              <div className="card-content">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
                  </div>
                  <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Exam Results</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {recentResults.length > 0 ? (
                recentResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{result.exam_title}</p>
                      <p className="text-sm text-gray-500">
                        {result.submitted_at ? new Date(result.submitted_at).toLocaleString() : 'In progress'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${result.is_passed ? 'text-green-600' : 'text-red-600'}`}>{result.percentage}%</p>
                      <p className="text-xs text-gray-500">Grade: {result.grade}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No completed exams yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Upcoming Exams</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {upcomingExams.length > 0 ? (
                upcomingExams.map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{exam.title}</p>
                      <p className="text-sm text-gray-500">Starts: {new Date(exam.start_date).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{exam.duration_minutes} min</p>
                      <p className="text-xs text-gray-500">{exam.total_questions} questions</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No upcoming exams.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
