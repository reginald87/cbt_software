'use client'

import { useEffect, useState, Fragment } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/utils/axios'
import { ScrollText, RefreshCw, Filter, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface AuditLog {
  id: number
  username: string
  action: string
  action_label: string
  model_name: string
  object_id: string
  details: any
  ip_address: string | null
  user_agent: string
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  'auth.login': 'bg-green-50 text-green-700 border-green-200',
  'auth.login_failed': 'bg-red-50 text-red-700 border-red-200',
  'auth.logout': 'bg-gray-50 text-gray-600 border-gray-200',
  'auth.change_password': 'bg-blue-50 text-blue-700 border-blue-200',
  'exam.create': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'exam.update': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'exam.status_change': 'bg-purple-50 text-purple-700 border-purple-200',
  'exam.submit': 'bg-teal-50 text-teal-700 border-teal-200',
  'exam.regrade_all': 'bg-orange-50 text-orange-700 border-orange-200',
  'exam.bulk_import': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'question.create': 'bg-amber-50 text-amber-700 border-amber-200',
  'question.update': 'bg-amber-50 text-amber-700 border-amber-200',
  'question.delete': 'bg-rose-50 text-rose-700 border-rose-200',
  'question.bulk_update': 'bg-amber-50 text-amber-700 border-amber-200',
  'question.bulk_import': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'category.create': 'bg-lime-50 text-lime-700 border-lime-200',
  'user.bulk_create': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
}

function getActionColor(action: string) {
  return ACTION_COLORS[action] || 'bg-gray-50 text-gray-600 border-gray-200'
}

export default function AuditLogs() {
  const { token } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [actions, setActions] = useState<string[]>([])
  const [filterAction, setFilterAction] = useState('')
  const [filterUsername, setFilterUsername] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [offset, setOffset] = useState(0)
  const [expandedDetails, setExpandedDetails] = useState<number | null>(null)
  const limit = 50

  const fetchLogs = async () => {
    try {
      setIsLoading(true)
      const params: Record<string, string | number> = {
        limit,
        offset,
      }
      if (filterAction) params.action = filterAction
      if (filterUsername) params.username = filterUsername
      if (filterSearch) params.search = filterSearch
      if (filterStart) params.start_date = filterStart
      if (filterEnd) params.end_date = filterEnd

      const response = await api.get('/audit/logs/', { params })
      setLogs(response.data.logs || [])
      setTotal(response.data.count || 0)
    } catch (error: any) {
      console.error('Failed to fetch audit logs:', error)
      toast.error(error.response?.data?.detail || 'Failed to load audit logs')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchActions = async () => {
    try {
      const response = await api.get('/audit/actions/')
      setActions((response.data || []).map((a: any) => a.action))
    } catch (error) {
      console.error('Failed to fetch audit actions:', error)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchActions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token) return
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, offset])

  const applyFilters = () => {
    setOffset(0)
    fetchLogs()
  }

  const clearFilters = () => {
    setFilterAction('')
    setFilterUsername('')
    setFilterSearch('')
    setFilterStart('')
    setFilterEnd('')
    setOffset(0)
    setTimeout(fetchLogs, 0)
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Record of important actions across the system</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <input
            type="text"
            value={filterUsername}
            onChange={(e) => setFilterUsername(e.target.value)}
            placeholder="Username..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search summary..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <input
            type="date"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="date"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Apply Filters
          </button>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Logs table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">{total} record{total !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No audit log entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Date/Time</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">User</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Action</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Summary</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedDetails(expandedDetails === log.id ? null : log.id)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-3 whitespace-nowrap text-gray-600">{formatDate(log.created_at)}</td>
                      <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900">{log.username}</td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{log.action_label}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-500">{log.ip_address || '-'}</td>
                    </tr>
                    {expandedDetails === log.id && (
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-gray-500 font-medium mb-1">Model / Object</p>
                              <p className="text-gray-700">
                                {log.model_name ? `${log.model_name} #${log.object_id}` : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 font-medium mb-1">Details</p>
                              <pre className="text-gray-700 whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded p-2">
                                {log.details ? JSON.stringify(log.details, null, 2) : '-'}
                              </pre>
                            </div>
                            <div>
                              <p className="text-gray-500 font-medium mb-1">User Agent</p>
                              <p className="text-gray-700 break-words">{log.user_agent || '-'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Showing {logs.length > 0 ? offset + 1 : 0}-{offset + logs.length} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
