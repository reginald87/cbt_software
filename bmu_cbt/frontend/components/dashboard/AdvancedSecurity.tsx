'use client'

import { useState, useEffect } from 'react'
import { 
  Shield, 
  Camera, 
  Monitor, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  User,
  Eye,
  Activity,
  Lock
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/utils/axios'

interface SecurityEvent {
  id: number
  type: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
  student_name?: string
  exam_title?: string
  ip_address?: string
}

interface ProctoringSession {
  id: number
  student_name: string
  student_username: string
  student_photo?: string | null
  exam_title: string
  start_time: string
  webcam_active: boolean
  screen_recording: boolean
  tab_switch_count: number
  security_score: number
}

export default function AdvancedSecurity() {
  const { token } = useAuth()
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [sessions, setSessions] = useState<ProctoringSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'events' | 'proctoring'>('events')

  useEffect(() => {
    if (!token) return
    fetchSecurityData()
    
    // Real-time polling every 10 seconds
    const interval = setInterval(fetchSecurityData, 10000)
    return () => clearInterval(interval)
  }, [token])

  const fetchSecurityData = async () => {
    try {
      setIsLoading(true)
      const [eventsResponse, sessionsResponse] = await Promise.all([
        api.get(`/results/security/events/`),
        api.get(`/results/security/proctoring-sessions/`)
      ])
      
      setEvents(eventsResponse.data)
      setSessions(sessionsResponse.data)
    } catch (error) {
      console.error('Failed to fetch security data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50'
      case 'high': return 'text-orange-600 bg-orange-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getSecurityScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading security data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Shield className="w-6 h-6 text-blue-600 mr-2" />
          Advanced Security
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'events'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Security Events
          </button>
          <button
            onClick={() => setActiveTab('proctoring')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'proctoring'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Proctoring Sessions
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Critical Events</p>
              <p className="text-2xl font-bold text-gray-900">
                {events.filter(e => e.severity === 'critical').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Eye className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Active Sessions</p>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.filter(s => s.webcam_active).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Camera className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Webcam Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.filter(s => s.webcam_active).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg Security Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.length > 0 
                  ? Math.round(sessions.reduce((acc, s) => acc + s.security_score, 0) / sessions.length)
                  : 0
                }%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Security Events</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {events.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No security events detected</p>
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(event.severity)}`}>
                          {event.severity.toUpperCase()}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">
                        {event.type}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {event.description}
                      </p>
                      {event.student_name && (
                        <div className="flex items-center text-xs text-gray-500">
                          <User className="w-3 h-3 mr-1" />
                          {event.student_name}
                          {event.exam_title && (
                            <>
                              <span className="mx-2">•</span>
                              <span>{event.exam_title}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <Activity className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'proctoring' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Live Proctoring Sessions</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No active proctoring sessions</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {session.student_photo ? (
                        <img 
                          src={session.student_photo} 
                          alt={session.student_name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {session.student_name}
                        </h4>
                        <p className="text-sm text-gray-500">{session.student_username}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getSecurityScoreColor(session.security_score)}`}>
                        {session.security_score}%
                      </div>
                      <p className="text-xs text-gray-500">Security Score</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center">
                      <Camera className={`w-4 h-4 mr-2 ${session.webcam_active ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="text-sm text-gray-600">
                        Webcam: {session.webcam_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Monitor className={`w-4 h-4 mr-2 ${session.screen_recording ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="text-sm text-gray-600">
                        Screen: {session.screen_recording ? 'Recording' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Eye className={`w-4 h-4 mr-2 ${session.tab_switch_count > 0 ? 'text-orange-600' : 'text-green-600'}`} />
                      <span className="text-sm text-gray-600">
                        Tab Switches: {session.tab_switch_count}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Started: {new Date(session.start_time).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                      View Details
                    </button>
                    <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                      Review Logs
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
