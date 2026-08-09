'use client'

import { useState } from 'react'
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react'
import api from '@/utils/axios'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface ImportResult {
  message: string
  imported: number
  errors: string[]
}

export default function BulkImport() {
  const { user, token } = useAuth()
  const [activeTab, setActiveTab] = useState<'exams' | 'questions'>('exams')
  const [isUploading, setIsUploading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImportResult(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload')
      return
    }

    setIsUploading(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('csv_file', selectedFile)

      const endpoint = activeTab === 'exams'
        ? '/exams/bulk/import/exams/'
        : '/exams/bulk/import/questions/'

      const response = await api.post(
        `${endpoint}`,
        formData
      )

      const result = response.data
      setImportResult(result)
      
      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} items`)
      }
      
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} errors occurred`)
      }

      setSelectedFile(null)
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }

    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error?.message || error?.response?.data?.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const downloadTemplate = () => {
    const template = activeTab === 'exams'
      ? `title,category_code,category_name,description,instructions,duration_minutes,passing_score,start_date,end_date,status,show_answers,show_score,shuffle_questions,shuffle_options,allow_review\n` +
        `Sample Exam,MATH,Mathematics,Basic mathematics exam,Read all questions carefully,60,70,2026-02-05 09:00:00,2026-02-05 11:00:00,active,true,true,false,false,true`
      : `exam_id,exam_title,question_text,question_type,marks,answer_options,correct_answer,latex_content,diagram_image,equation_type,explanation\n` +
        `,Sample Exam,Which of the following is a synonym for 'benevolent'?,multiple,2,Kind|Cruel|Angry|Indifferent,Kind,,,,"General English vocabulary"\n` +
        `,Sample Exam,Choose the correctly spelt word.,multiple,2,Occasion|Ocassion|Ocasion|Occassion,Occasion,,,,"English spelling test"\n` +
        `,Sample Exam,The word 'their' is a possessive pronoun.,true_false,1,,true,,,,"English grammar"\n` +
        `,Sample Exam,A person who writes books is called a(n) ____.,fill_blank,2,,author,,,,"English vocabulary"\n` +
        `,Sample Exam,Solve for x: 2x + 4 = 10,math,5,,,2x + 4 = 10,,algebraic,Basic algebra\n` +
        `,Sample Exam,Balance: H2 + O2 -> H2O,chemistry,5,,,H2 + O2 -> H2O,,chemical,Balance the equation\n` +
        `,Sample Exam,Which device is used to measure electric current?,multiple,2,Ammeter|Voltmeter|Barometer|Thermometer,Ammeter,,,,"Physics: electricity"\n` +
        `,Sample Exam,Study the circuit diagram and explain what happens to the bulb when the switch is closed.,physics,3,,,,circuit_diagram.png,physics,Diagram question - file must already exist in media/question_diagrams/`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeTab}-template.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (!user?.is_superuser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-500">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Bulk Import</h2>
        <p className="text-gray-600">Import exams and questions in bulk using CSV files</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('exams')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'exams'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Exams
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'questions'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Questions
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="space-y-6">
          {/* Instructions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Import {activeTab === 'exams' ? 'Exams' : 'Questions'}
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Instructions:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Download the template file below</li>
                <li>• Fill in your data following the exact format</li>
                <li>• Save as CSV file</li>
                <li>• Upload the file using the form</li>
                {activeTab === 'questions' && (
                  <>
                    <li>• For math questions: Use LaTeX format (e.g., $x^2 + 5x + 6 = 0$)</li>
                    <li>• For chemistry: Use chemical notation (e.g., 2H2 + O2 → 2H2O)</li>
                    <li>• For images: save the image file (jpg, png, webp, etc.) in the server's <strong>media/question_diagrams/</strong> folder, then put just the filename (e.g. <code>plant_cell.png</code>) in the <code>diagram_image</code> column</li>
                    <li>• Supported question types: multiple, true_false, fill_blank, short, math, chemistry, physics, biology, comprehension</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* Download Template */}
          <div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>

          {/* Upload Form */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Upload CSV File</h4>
            <div className="space-y-4">
              <div>
                <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>

              {selectedFile && (
                <div className="text-sm text-gray-600">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload {activeTab === 'exams' ? 'Exams' : 'Questions'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Import Results */}
          {importResult && (
            <div className={`rounded-lg p-4 ${
              importResult.imported > 0 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {importResult.imported > 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`font-medium ${
                    importResult.imported > 0 ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {importResult.message}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    importResult.imported > 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {importResult.imported} items imported successfully
                  </p>
                  
                  {importResult.errors.length > 0 && (
                    <div className="mt-3">
                      <h5 className="font-medium text-red-900 mb-2">Errors:</h5>
                      <ul className="text-sm text-red-700 space-y-1">
                        {importResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
