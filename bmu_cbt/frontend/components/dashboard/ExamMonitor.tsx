'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/utils/axios'
import { Activity, Users, Clock, AlertCircle, TrendingUp, Eye, User } from 'lucide-react'

interface ActiveExam {
  id: number
  title: string
  active_attempts: number
  total_attempts: number
  avg_progress: number
  time_remaining: number
  category: string
}

interface ActiveAttempt {
  id: number
  exam_title: string
  student_name: string
  student_username: string
  student_photo?: string | null
  progress: number
  time_remaining: number
  ip_address: string
  start_time: string
  last_activity: string
}

interface MonitorStats {
  total_active_exams: number
  total_active_students: number
  avg_completion_rate: number
  total_attempts_today: number
}

export default function ExamMonitor() {
  const { token } = useAuth()
  const [activeExams, setActiveExams] = useState<ActiveExam[]>([])
  const [activeAttempts, setActiveAttempts] = useState<ActiveAttempt[]>([])
  const [stats, setStats] = useState<MonitorStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedExam, setSelectedExam] = useState<number | null>(null)

  const fetchMonitorData = async () => {
    try {
      setError(null)
      
      // Fetch active exams
      const examsResponse = await api.get(
        `/results/monitor/active-exams/`
      )
      
      // Fetch active attempts
      const attemptsResponse = await api.get(
        `/results/monitor/active-attempts/`
      )
      
      // Fetch stats
      const statsResponse = await api.get(
        `/results/monitor/stats/`
      )
      
      setActiveExams(examsResponse.data)
      setActiveAttempts(attemptsResponse.data)
      setStats(statsResponse.data)
    } catch (error: any) {
      console.error('Failed to fetch monitor data:', error)
      setError('Failed to load monitoring data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchMonitorData()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchMonitorData, 30000)
    return () => clearInterval(interval)
  }, [token])

  const filteredAttempts = selectedExam 
    ? activeAttempts.filter(attempt => attempt.exam_title.includes(activeExams.find(exam => exam.id === selectedExam)?.title || ''))
    : activeAttempts

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'text-green-600'
    if (progress >= 50) return 'text-yellow-600'
    return 'text-red-600'
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
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Monitoring Error</h3>
        <p className="text-gray-500">{error}</p>
        <button className="btn-primary mt-4" onClick={fetchMonitorData}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Exam Monitor</h2>
        <p className="text-gray-600">Real-time monitoring of active exams and student attempts</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-6 h-6 text-blue-500" />
              <h3 className="text-sm font-medium text-gray-500">Active Exams</h3>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_active_exams}</div>
            <div className="text-xs text-gray-500">Currently running</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-green-500" />
              <h3 className="text-sm font-medium text-gray-500">Active Students</h3>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_active_students}</div>
            <div className="text-xs text-gray-500">Taking exams now</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-purple-500" />
              <h3 className="text-sm font-medium text-gray-500">Avg Completion</h3>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.avg_completion_rate.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">Progress rate</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-orange-500" />
              <h3 className="text-sm font-medium text-gray-500">Today's Attempts</h3>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_attempts_today}</div>
            <div className="text-xs text-gray-500">Total attempts</div>
          </div>
        </div>
      )}

      {/* Active Exams */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Active Exams</h3>
          <Eye className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="space-y-3">
          {activeExams.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active exams at the moment
            </div>
          ) : (
            activeExams.map((exam) => (
              <div
                key={exam.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedExam === exam.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedExam(selectedExam === exam.id ? null : exam.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{exam.title}</h4>
                    <div className="text-sm text-gray-500">{exam.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {exam.active_attempts} / {exam.total_attempts}
                    </div>
                    <div className="text-xs text-gray-500">Active / Total</div>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${exam.avg_progress}%` }}
                      />
                    </div>
                    <span>{exam.avg_progress.toFixed(0)}% avg progress</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(exam.time_remaining)} remaining</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Attempts */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Active Attempts {selectedExam && `(Filtered)`}
          </h3>
          <div className="text-sm text-gray-500">
            {filteredAttempts.length} students
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Student</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Exam</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Progress</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Time Remaining</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">IP Address</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No active attempts found
                  </td>
                </tr>
              ) : (
                filteredAttempts.map((attempt) => (
                  <tr key={attempt.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {attempt.student_photo ? (
                          <img 
                            src={attempt.student_photo} 
                            alt={attempt.student_name}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{attempt.student_name}</div>
                          <div className="text-xs text-gray-500">{attempt.student_username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{attempt.exam_title}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              attempt.progress >= 80 ? 'bg-green-500' :
                              attempt.progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} 
                            style={{ width: `${attempt.progress}%` }}
                          />
                        </div>
                        <span className={`font-medium ${getProgressColor(attempt.progress)}`}>
                          {attempt.progress.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Clock className="w-3 h-3" />
                        {formatTime(attempt.time_remaining)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{attempt.ip_address}</td>
                    <td className="py-3 px-4 text-gray-700">
                      {new Date(attempt.last_activity).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
