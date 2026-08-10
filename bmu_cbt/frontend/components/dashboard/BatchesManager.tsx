'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/utils/axios'
import { Layers, RefreshCw, Trash2, UserPlus, UserMinus, Save, Plus, Users, FileText, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface BatchStudent {
  id: number
  username: string
  full_name: string
  identifier: string
}

interface Batch {
  id: number
  exam_id: number
  name: string
  start_time: string
  end_time: string
  order: number
  student_count: number
  question_count: number
  students: BatchStudent[]
}

interface BatchesData {
  exam_id: number
  total_students: number
  has_batches: boolean
  paper_size: number
  batches: Batch[]
  unassigned_students: BatchStudent[]
}

interface BatchesManagerProps {
  examId: number
}

const toLocalInput = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function BatchesManager({ examId }: BatchesManagerProps) {
  const [data, setData] = useState<BatchesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Create form
  const [createCount, setCreateCount] = useState(4)
  const [createStart, setCreateStart] = useState('')
  const [createEnd, setCreateEnd] = useState('')
  const [createPaperSize, setCreatePaperSize] = useState('')

  // Per-batch edits
  const [edits, setEdits] = useState<Record<number, { name: string; start_time: string; end_time: string }>>({})
  const [busyId, setBusyId] = useState<number | null>(null)

  const fetchBatches = useCallback(async () => {
    try {
      const response = await api.get(`/exams/${examId}/batches/`)
      setData(response.data)
      const editMap: Record<number, { name: string; start_time: string; end_time: string }> = {}
      response.data.batches.forEach((b: Batch) => {
        editMap[b.id] = {
          name: b.name,
          start_time: toLocalInput(b.start_time),
          end_time: toLocalInput(b.end_time),
        }
      })
      setEdits(editMap)
    } catch (error: any) {
      console.error('Failed to load batches:', error)
      toast.error(error.response?.data?.detail || 'Failed to load batches')
    } finally {
      setLoading(false)
    }
  }, [examId])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  const handleCreate = async () => {
    if (!createStart || !createEnd) {
      toast.error('Please set the first batch start time and last batch end time')
      return
    }
    setCreating(true)
    try {
      const response = await api.post(`/exams/${examId}/batches/create/`, {
        count: createCount,
        start_time: createStart,
        end_time: createEnd,
        paper_size: createPaperSize ? parseInt(createPaperSize) : null,
      })
      toast.success(response.data.message || 'Batches created')
      setShowCreateForm(false)
      await fetchBatches()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create batches')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveBatch = async (batchId: number) => {
    const edit = edits[batchId]
    if (!edit) return
    setBusyId(batchId)
    try {
      const response = await api.patch(`/exams/${examId}/batches/${batchId}/`, {
        name: edit.name,
        start_time: edit.start_time,
        end_time: edit.end_time,
      })
      toast.success('Batch updated')
      setEdits(prev => ({
        ...prev,
        [batchId]: {
          name: response.data.name,
          start_time: toLocalInput(response.data.start_time),
          end_time: toLocalInput(response.data.end_time),
        },
      }))
      await fetchBatches()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update batch')
    } finally {
      setBusyId(null)
    }
  }

  const handleAddStudent = async (batchId: number, studentId: number) => {
    setBusyId(batchId)
    try {
      await api.patch(`/exams/${examId}/batches/${batchId}/`, { add_student_id: studentId })
      toast.success('Student assigned to batch')
      await fetchBatches()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to assign student')
    } finally {
      setBusyId(null)
    }
  }

  const handleRemoveStudent = async (batchId: number, studentId: number) => {
    setBusyId(batchId)
    try {
      await api.patch(`/exams/${examId}/batches/${batchId}/`, { remove_student_id: studentId })
      toast.success('Student removed from batch')
      await fetchBatches()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to remove student')
    } finally {
      setBusyId(null)
    }
  }

  const handleRegenerate = async (batchId: number) => {
    setBusyId(batchId)
    try {
      const response = await api.patch(`/exams/${examId}/batches/${batchId}/`, { regenerate: true })
      toast.success(`Paper regenerated (${response.data.question_count} questions)`)
      await fetchBatches()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to regenerate paper')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (batchId: number, name: string) => {
    if (!window.confirm(`Delete ${name}? Students will become unassigned.`)) return
    setBusyId(batchId)
    try {
      await api.delete(`/exams/${examId}/batches/${batchId}/`)
      toast.success('Batch deleted')
      await fetchBatches()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete batch')
    } finally {
      setBusyId(null)
    }
  }

  const setEdit = (batchId: number, field: 'name' | 'start_time' | 'end_time', value: string) => {
    setEdits(prev => ({
      ...prev,
      [batchId]: { ...(prev[batchId] || { name: '', start_time: '', end_time: '' }), [field]: value },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-gray-500">Unable to load batch information.</p>
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-600" />
            Exam Batches
          </h3>
          <p className="text-sm text-gray-500">
            {data.has_batches
              ? `${data.batches.length} batch(es) · ${data.total_students} student(s) split across them`
              : 'Students are assigned to batches, each with its own window and randomly-drawn paper.'}
            {data.paper_size > 0 && ` · Paper: ${data.paper_size} question(s)`}
          </p>
        </div>
        {data.has_batches && (
          <button
            onClick={() => setShowCreateForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Batches
          </button>
        )}
      </div>

      {/* Create form (shown when there are no batches, or toggled on) */}
      {(showCreateForm || !data.has_batches) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h4 className="font-medium text-gray-900">
            {data.has_batches ? 'Add More Batches' : 'Split Students into Batches'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Batches</label>
              <input
                type="number"
                min={1}
                max={50}
                value={createCount}
                onChange={(e) => setCreateCount(parseInt(e.target.value) || 1)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Questions per Paper (leave blank for all)
              </label>
              <input
                type="number"
                min={1}
                value={createPaperSize}
                onChange={(e) => setCreatePaperSize(e.target.value)}
                placeholder="e.g. 30"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Batch Starts</label>
              <input
                type="datetime-local"
                value={createStart}
                onChange={(e) => setCreateStart(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Batch Ends</label>
              <input
                type="datetime-local"
                value={createEnd}
                onChange={(e) => setCreateEnd(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            The overall window is split evenly across batches. Each batch's paper is drawn randomly from the
            question bank. You can adjust windows and move students afterwards.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
            >
              <Layers className="w-4 h-4" />
              {creating ? 'Creating...' : 'Create Batches & Assign Students'}
            </button>
            {data.has_batches && (
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Batch cards */}
      {data.batches.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Batches Yet</h4>
          <p className="text-gray-500">Create batches above to split your students and draw papers.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.batches.map((batch) => {
            const edit = edits[batch.id]
            return (
              <div key={batch.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Batch Name</label>
                      <input
                        type="text"
                        value={edit?.name ?? ''}
                        onChange={(e) => setEdit(batch.id, 'name', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Starts
                      </label>
                      <input
                        type="datetime-local"
                        value={edit?.start_time ?? ''}
                        onChange={(e) => setEdit(batch.id, 'start_time', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Ends
                      </label>
                      <input
                        type="datetime-local"
                        value={edit?.end_time ?? ''}
                        onChange={(e) => setEdit(batch.id, 'end_time', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(batch.id, batch.name)}
                    disabled={busyId === batch.id}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    title="Delete batch"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{batch.student_count}</span> students
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{batch.question_count}</span> questions in paper
                  </div>
                  <button
                    onClick={() => handleSaveBatch(batch.id)}
                    disabled={busyId === batch.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                  <button
                    onClick={() => handleRegenerate(batch.id)}
                    disabled={busyId === batch.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate Paper
                  </button>
                </div>

                {/* Students */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium text-gray-700">Assigned Students</h5>
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-gray-400" />
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddStudent(batch.id, parseInt(e.target.value))
                            e.target.value = ''
                          }
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="">Add student...</option>
                        {data.unassigned_students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} ({s.identifier || s.username})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {batch.students.length === 0 ? (
                    <p className="text-sm text-gray-400">No students assigned to this batch.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {batch.students.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-full"
                        >
                          {s.full_name}
                          <span className="text-xs text-gray-500">({s.identifier || s.username})</span>
                          <button
                            onClick={() => handleRemoveStudent(batch.id, s.id)}
                            disabled={busyId === batch.id}
                            className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                            title="Remove from batch"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
