'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/utils/axios'
import { RefreshCw, Bug } from 'lucide-react'

export default function AdminTools() {
  const { token } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [attemptId, setAttemptId] = useState('')

  const regradeAllAttempts = async () => {
    if (!confirm('This will regrade all submitted exam attempts. Continue?')) return
    
    setIsLoading(true)
    try {
      const response = await api.post(
        `/results/regrade-all-attempts/`,
        {}
      )
      setResult(response.data)
      
      // Refresh the page data after regrade
      window.location.reload()
    } catch (error: any) {
      alert('Error: ' + (error.response?.data?.error || error.message))
    } finally {
      setIsLoading(false)
    }
  }

  const debugAttempt = async () => {
    if (!attemptId) {
      alert('Please enter an attempt ID')
      return
    }
    
    setIsLoading(true)
    try {
      const response = await api.get(
        `/results/debug-attempt/${attemptId}/`
      )
      setResult(response.data)
    } catch (error: any) {
      alert('Error: ' + (error.response?.data?.error || error.message))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Tools</h2>
        <p className="text-gray-600">Diagnostic and repair tools for exam system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Regrade All Attempts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Regrade All Attempts</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Recalculate scores for all submitted exam attempts. Use this if scores appear incorrect.
          </p>
          <button
            onClick={regradeAllAttempts}
            disabled={isLoading}
            className="btn btn-primary w-full"
          >
            {isLoading ? 'Processing...' : 'Regrade All Attempts'}
          </button>
        </div>

        {/* Debug Attempt */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Bug className="w-6 h-6 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900">Debug Attempt</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Inspect a specific exam attempt to see detailed information and answers.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={attemptId}
              onChange={(e) => setAttemptId(e.target.value)}
              placeholder="Attempt ID"
              className="input flex-1"
            />
            <button
              onClick={debugAttempt}
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading ? 'Debugging...' : 'Debug'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Display */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Results</h3>
            <button
              onClick={() => setResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
