'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/utils/axios'
import { Upload, Download, Users, CheckCircle, AlertCircle, FileText, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'

interface StudentData {
  first_name: string
  last_name: string
  email?: string
  user_type: string
  matric_number?: string
  jamb_number?: string
  department?: string
  course?: string
  year_of_entry?: number
}

interface UploadResult {
  total_rows: number
  successful: number
  failed: number
  errors: string[]
  credentials: Array<{
    first_name: string
    last_name: string
    username: string
    password: string
    user_type: string
    matric_number?: string
    jamb_number?: string
    department?: string
  }>
}

export default function BulkStudentUpload() {
  const { token } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [credStatus, setCredStatus] = useState<{ pending_export: number; total_students: number } | null>(null)
  const [credUserType, setCredUserType] = useState('')
  const [credDepartment, setCredDepartment] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  const fetchCredStatus = async () => {
    try {
      const response = await api.get(`/users/bulk-upload/credentials/status/`)
      setCredStatus(response.data)
    } catch (error) {
      console.error('Failed to fetch credentials status:', error)
    }
  }

  useEffect(() => {
    fetchCredStatus()
  }, [])

  const downloadTemplate = async () => {
    try {
      const response = await api.get(
        `/users/bulk-upload/template/`,
        {
          responseType: 'blob'
        }
      )
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'student_upload_template.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download template:', error)
      setError('Failed to download template')
    }
  }

  const exportCredentials = async (userType: string = '', department: string = '') => {
    try {
      const params: Record<string, string> = {}
      if (userType) params.user_type = userType
      if (department.trim()) params.department = department.trim()

      const response = await api.get(
        `/users/bulk-upload/credentials/export/`,
        {
          responseType: 'blob',
          params,
        }
      )

      // A CSV with only the header row means there is nothing to export.
      const text = await response.data.text()
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length <= 1) {
        setError('No credentials are pending export for the selected criteria')
        return false
      }

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      link.setAttribute('download', `student_credentials_${stamp}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      fetchCredStatus()
      return true
    } catch (error) {
      console.error('Failed to export credentials:', error)
      setError('Failed to export credentials')
      return false
    }
  }

  const regenerateCredentials = async () => {
    if (!window.confirm(
      'This will reset the passwords for the selected existing students. ' +
      'Their new credentials will be downloaded once as a CSV. Continue?'
    )) {
      return
    }

    setRegenerating(true)
    setError(null)
    try {
      const response = await api.post(
        `/users/bulk-upload/credentials/regenerate/`,
        {
          user_type: credUserType || null,
          department: credDepartment.trim() || null,
        }
      )

      const count = response.data.regenerated
      if (!count) {
        setError('No students matched the selected criteria')
        return
      }

      const exported = await exportCredentials(credUserType, credDepartment)
      if (exported) {
        toast.success(`Regenerated credentials for ${count} students`)
        fetchCredStatus()
      }
    } catch (error: any) {
      console.error('Failed to regenerate credentials:', error)
      setError(error.response?.data?.detail || 'Failed to regenerate credentials')
    } finally {
      setRegenerating(false)
    }
  }

  const parseCSV = (text: string): StudentData[] => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []
    
    const headers = lines[0].split(',').map(h => h.trim())
    const students: StudentData[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      
      if (values.length >= headers.length) {
        const student: StudentData = {
          first_name: values[0] || '',
          last_name: values[1] || '',
          email: values[2] || undefined,
          user_type: values[3] || 'matriculated',
          matric_number: values[4] || undefined,
          jamb_number: values[5] || undefined,
          department: values[6] || undefined,
          course: values[7] || undefined,
          year_of_entry: values[8] ? parseInt(values[8]) : undefined
        }
        
        if (student.first_name && student.last_name) {
          students.push(student)
        }
      }
    }
    
    return students
  }

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setIsLoading(true)
    setError(null)
    setUploadResult(null)

    try {
      const text = await file.text()
      const students = parseCSV(text)
      
      if (students.length === 0) {
        setError('No valid student data found in file')
        setIsLoading(false)
        return
      }

      const response = await api.post(
        `/users/bulk-upload/data/`,
        students
      )

      setUploadResult(response.data)
    } catch (error: any) {
      console.error('Upload failed:', error)
      setError(error.response?.data?.error || 'Failed to upload students')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0])
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Student Upload</h1>
          <p className="text-gray-600 mt-2">
            Upload multiple student accounts at once with auto-generated credentials
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="btn btn-outline flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download Template
        </button>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Upload Student CSV File
          </h3>
          <p className="text-gray-600 mb-4">
            Drag and drop your CSV file here, or click to browse
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="btn btn-primary cursor-pointer"
          >
            Choose File
          </label>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Upload Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="mt-4 text-center">
            <div className="loading-spinner w-8 h-8 mx-auto mb-2" />
            <p className="text-gray-600">Processing student data...</p>
          </div>
        )}
      </div>

      {/* Existing Student Credentials */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Existing Student Credentials</h2>
            <p className="text-gray-600 text-sm mt-1">
              Download or regenerate login credentials for students already in the system.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-gray-50 rounded-lg px-4 py-2 text-center">
              <p className="text-xs text-gray-500">Pending Export</p>
              <p className="text-lg font-bold text-gray-900">{credStatus?.pending_export ?? '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-2 text-center">
              <p className="text-xs text-gray-500">Total Students</p>
              <p className="text-lg font-bold text-gray-900">{credStatus?.total_students ?? '—'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
            <select
              value={credUserType}
              onChange={(e) => setCredUserType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Students</option>
              <option value="matriculated">Matriculated Students</option>
              <option value="100level">100 Level Students</option>
              <option value="intending">Intending Students</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              type="text"
              value={credDepartment}
              onChange={(e) => setCredDepartment(e.target.value)}
              placeholder="e.g., Medicine (leave blank for all)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => exportCredentials(credUserType, credDepartment)}
            disabled={!credStatus || credStatus.pending_export === 0}
            className="btn btn-outline flex items-center gap-2 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            Download Pending Credentials
          </button>
          <button
            onClick={regenerateCredentials}
            disabled={regenerating}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            {regenerating ? 'Regenerating...' : 'Regenerate & Download Credentials'}
          </button>
        </div>

        {credStatus && credStatus.pending_export === 0 && credStatus.total_students > 0 && (
          <p className="text-sm text-amber-600 mt-3">
            No credentials are pending export. Existing students' passwords are hashed and cannot be
            recovered — use "Regenerate &amp; Download" to issue fresh passwords.
          </p>
        )}
      </div>

      {/* Results */}
      {uploadResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Upload Results</h2>
            {uploadResult.credentials.length > 0 && (
              <button
                onClick={() => exportCredentials()}
                className="btn btn-primary flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Export Credentials
              </button>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900">{uploadResult.total_rows}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Successfully Created</p>
                  <p className="text-2xl font-bold text-green-600">{uploadResult.successful}</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{uploadResult.failed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Errors */}
          {uploadResult.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-red-800 mb-3">Errors</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <ul className="space-y-2">
                  {uploadResult.errors.map((error, index) => (
                    <li key={index} className="text-red-700 text-sm flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Credentials Preview */}
          {uploadResult.credentials.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Generated Credentials</h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Password</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {uploadResult.credentials.slice(0, 10).map((cred, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {cred.first_name} {cred.last_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-mono">{cred.username}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-mono">{cred.password}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{cred.user_type}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {cred.matric_number || cred.jamb_number || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {uploadResult.credentials.length > 10 && (
                    <div className="px-4 py-3 bg-gray-100 text-center text-sm text-gray-600">
                      ... and {uploadResult.credentials.length - 10} more students
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Download the full credentials list to print and distribute to students.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
