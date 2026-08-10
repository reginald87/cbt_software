'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Download, TrendingUp, Award, Clock, CheckCircle, XCircle } from 'lucide-react'
import api from '@/utils/axios'
import { useAuth } from '@/contexts/AuthContext'

interface ExamResult {
  id: number
  exam_title: string
  exam_category?: string
  batch_id?: number
  batch_name?: string
  status: string
  percentage: number
  grade: string | null
  is_passed: boolean
  passing_score?: number
  start_time: string
  submitted_at: string
  time_taken_seconds?: number
}

export default function Results() {
  const { token } = useAuth()
  const [results, setResults] = useState<ExamResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [filterBatchId, setFilterBatchId] = useState<string>('')

  useEffect(() => {
    if (!token) return
    fetchResults()
  }, [token])

  const fetchResults = async () => {
    try {
      setError(null)
      const response = await api.get(`/results/admin/attempts/`)
      setResults(response.data)
    } catch (error) {
      console.error('Failed to fetch results:', error)
      setError('Failed to load results. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadResults = async () => {
    if (isDownloading) return
    
    setIsDownloading(true)
    try {
      const response = await api.get(
        `/results/export/exam-results/`,
        {
          params: {
            batch_id: filterBatchId ? Number(filterBatchId) : undefined
          },
          responseType: 'blob'
        }
      )
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `exam_results_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download results:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const formatTime = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const getGradeColor = (grade: string | null) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100'
      case 'B': return 'text-blue-600 bg-blue-100'
      case 'C': return 'text-yellow-600 bg-yellow-100'
      case 'D': return 'text-orange-600 bg-orange-100'
      case 'E': return 'text-red-600 bg-red-100'
      case 'F': return 'text-red-700 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const batches = Array.from(
    new Map(
      results
        .filter((r) => r.batch_id)
        .map((r) => [r.batch_id, { id: r.batch_id as number, name: r.batch_name || 'Unknown' }])
    ).values()
  )

  const visibleResults = filterBatchId
    ? results.filter((r) => r.batch_id === Number(filterBatchId))
    : results

  const averageScore = visibleResults.length > 0 
    ? visibleResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / visibleResults.length 
    : 0

  const passRate = visibleResults.length > 0 
    ? (visibleResults.filter(r => r.is_passed).length / visibleResults.length) * 100 
    : 0

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
        <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load results</h3>
        <p className="text-gray-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 sm:px-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Exam Results</h1>
          <p className="text-base sm:text-lg text-gray-600">
            Your exam history and performance
          </p>
        </div>
        <button
          onClick={downloadResults}
          disabled={isDownloading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105 active:scale-95 min-w-[140px]"
        >
          {isDownloading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Downloading...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Download Results</span>
            </>
          )}
        </button>
      </div>

      {/* Batch filter */}
      {batches.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <label className="text-sm font-medium text-gray-600">Filter by batch:</label>
          <select
            value={filterBatchId}
            onChange={(e) => setFilterBatchId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-400">
            {filterBatchId ? `${visibleResults.length} result(s) in this batch` : `${results.length} result(s) total`}
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Exams</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{visibleResults.length}</p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Passed</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {visibleResults.filter(r => r.is_passed).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {visibleResults.filter(r => !r.is_passed).length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Score</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {averageScore.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Exam History</h2>
        </div>
        
        {visibleResults.length > 0 ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-full sm:min-w-0">
              <table className="w-full min-w-[600px] sm:min-w-0">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exam Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visibleResults.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {result.exam_title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {result.exam_category}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {result.batch_name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {result.submitted_at ? new Date(result.submitted_at).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {result.submitted_at ? new Date(result.submitted_at).toLocaleTimeString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {result.percentage?.toFixed(1) || 0}%
                          </span>
                          <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                (result.percentage || 0) >= (result.passing_score || 0)
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(result.percentage || 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            getGradeColor(result.grade)
                          }`}
                        >
                          {result.grade || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            result.is_passed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {result.is_passed ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" /> Passed
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" /> Failed
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatTime(result.time_taken_seconds)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No exam results yet</h3>
            <p className="text-gray-500">
              You haven't completed any exams. Start an exam to see your results here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
