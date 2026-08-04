'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/utils/axios'
import { Shield, AlertTriangle, Eye, Camera, Monitor, Activity, Clock, User } from 'lucide-react'

interface SecurityEvent {
  id: string
  timestamp: string
  event_type: string
  student_name: string
  student_username: string
  exam_title: string
  attempt_id: number
  details: any
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface SecurityStats {
  total_events: number
  critical_events: number
  active_exams_with_issues: number
  students_flagged: number
  tab_switches: number
  screen_recordings: number
  webcam_captures: number
  session_anomalies: number
}

export default function SecurityDashboard() {
  const { token } = useAuth()
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [selectedEventType, setSelectedEventType] = useState<string>('all')

  const fetchSecurityData = async () => {
    try {
      setError(null)
      
      // Fetch security events
      const eventsResponse = await api.get(
        `/results/security/events/`
      )
      
      // Fetch security stats
      const statsResponse = await api.get(
        `/results/security/stats/`
      )
      
      setEvents(eventsResponse.data)
      setStats(statsResponse.data)
    } catch (error: any) {
      console.error('Failed to fetch security data:', error)
      setError('Failed to load security monitoring data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchSecurityData()
    
    // Refresh every 30 seconds for real-time monitoring
    const interval = setInterval(fetchSecurityData, 30000)
    return () => clearInterval(interval)
  }, [token])

  const filteredEvents = events.filter(event => {
    const severityMatch = selectedSeverity === 'all' || event.severity === selectedSeverity
    const typeMatch = selectedEventType === 'all' || event.event_type === selectedEventType
    return severityMatch && typeMatch
  })

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'tab_switch': return <Eye className="w-4 h-4" />
      case 'screen_recording': return <Monitor className="w-4 h-4" />
      case 'webcam_capture': return <Camera className="w-4 h-4" />
      case 'session_anomaly': return <AlertTriangle className="w-4 h-4" />
      case 'window_blur': return <Activity className="w-4 h-4" />
      default: return <Shield className="w-4 h-4" />
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
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
        <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Security Monitoring Error</h3>
        <p className="text-gray-500">{error}</p>
        <button className="btn-primary mt-4" onClick={fetchSecurityData}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Security Dashboard</h2>
        <p className="text-gray-600">Real-time security monitoring and proctoring events</p>
      </div>

      {/* Security Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-6 h-6 text-purple-500" />
              <h3 className="text-sm font-medium text-gray-500">Total Events</h3>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_events}</div>
            <div className="text-xs text-gray-500">Security events</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="text-sm font-medium text-gray-500">Critical Events</h3>
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.critical_events}</div>
            <div className="text-xs text-gray-500">Requires attention</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-6 h-6 text-orange-500" />
              <h3 className="text-sm font-medium text-gray-500">Tab Switches</h3>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.tab_switches}</div>
            <div className="text-xs text-gray-500">Window violations</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Camera className="w-6 h-6 text-blue-500" />
              <h3 className="text-sm font-medium text-gray-500">Proctoring</h3>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.webcam_captures}</div>
            <div className="text-xs text-gray-500">Webcam captures</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full input"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="w-full input"
            >
              <option value="all">All Events</option>
              <option value="tab_switch">Tab Switch</option>
              <option value="screen_recording">Screen Recording</option>
              <option value="webcam_capture">Webcam Capture</option>
              <option value="session_anomaly">Session Anomaly</option>
              <option value="window_blur">Window Blur</option>
            </select>
          </div>
        </div>
      </div>

      {/* Security Events */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Security Events</h3>
          <div className="text-sm text-gray-500">
            {filteredEvents.length} events
          </div>
        </div>
        
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No security events found
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg border ${getSeverityColor(event.severity)}`}>
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 capitalize">
                          {event.event_type.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full border ${getSeverityColor(event.severity)}`}>
                          {event.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3" />
                          {event.student_name} ({event.student_username})
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {formatTime(event.timestamp)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Exam: {event.exam_title} | Attempt #{event.attempt_id}
                      </div>
                      {event.details && (
                        <div className="mt-2 text-xs text-gray-400 bg-gray-50 p-2 rounded">
                          {JSON.stringify(event.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
