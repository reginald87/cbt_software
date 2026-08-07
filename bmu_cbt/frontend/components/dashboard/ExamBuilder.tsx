'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/utils/axios'
import { 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  Upload, 
  ChevronDown, 
  ChevronUp,
  Type,
  Image,
  Calculator,
  FlaskConical,
  Atom,
  Dna,
  BookOpen
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Question {
  id?: number
  question_text: string
  question_type: 'multiple' | 'true_false' | 'fill_blank' | 'short' | 'math' | 'chemistry' | 'physics' | 'biology' | 'comprehension'
  marks: number
  order: number
  correct_answer?: string
  latex_content?: string
  diagram_image?: string
  equation_type?: 'algebraic' | 'chemical' | 'physics' | 'statistical'
  explanation?: string
  // Comprehension support
  comprehension_passage?: string
  comprehension_group?: string
  answers?: AnswerOption[]
}

interface AnswerOption {
  id?: number
  answer_text: string
  is_correct: boolean
  order: number
}

interface Exam {
  id?: number
  title: string
  description: string
  instructions: string
  duration_minutes: number
  total_questions: number
  passing_score: number
  difficulty_level: 'easy' | 'medium' | 'hard'
  category: string | null
  start_date: string
  end_date: string
  status: 'draft' | 'published' | 'closed'
  questions: Question[]
}

interface ExamBuilderProps {
  examId?: number | null
}

export default function ExamBuilder({ examId }: ExamBuilderProps) {
  const { token } = useAuth()
  const [exam, setExam] = useState<Exam>({
    title: '',
    description: '',
    instructions: '',
    duration_minutes: 60,
    total_questions: 0,
    passing_score: 50,
    difficulty_level: 'medium',
    category: '',
    start_date: '',
    end_date: '',
    status: 'draft',
    questions: []
  })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'questions'>('details')
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryCode, setNewCategoryCode] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  useEffect(() => {
    fetchCategories()
    if (examId) {
      fetchExam(examId)
    }
  }, [examId])

  const fetchCategories = async () => {
    try {
      const response = await api.get(
        `/exams/categories/`
      )
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      if (error.response?.status === 401) {
        toast.error('Please login to access this feature')
      } else {
        toast.error('Failed to load categories')
      }
    }
  }

  const createCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required')
      return
    }
    if (!newCategoryCode.trim()) {
      toast.error('Category code is required (e.g., ENG101)')
      return
    }

    setCreatingCategory(true)
    try {
      const response = await api.post('/exams/categories/', {
        name: newCategoryName.trim(),
        code: newCategoryCode.trim(),
      })
      const newCat = response.data
      setCategories(prev => [...prev, newCat].sort((a: any, b: any) => a.name.localeCompare(b.name)))
      setExam(prev => ({ ...prev, category: String(newCat.id) }))
      setNewCategoryName('')
      setNewCategoryCode('')
      setShowCategoryForm(false)
      toast.success('Category created successfully')
    } catch (error: any) {
      console.error('Failed to create category:', error)
      toast.error(error.response?.data?.detail || 'Failed to create category')
    } finally {
      setCreatingCategory(false)
    }
  }

  const fetchExam = async (id: number) => {
    try {
      const response = await api.get(
        `/exams/${id}/`
      )
      const data = response.data
      setExam(prev => ({
        ...prev,
        ...data,
        category: data.category && typeof data.category === 'object' ? String(data.category.id) : (data.category || ''),
        total_questions: data.questions?.length ?? prev.total_questions,
      }))
    } catch (error) {
      console.error('Failed to fetch exam:', error)
    }
  }

  const addQuestion = (type: Question['question_type']) => {
    const newQuestion: Question = {
      question_text: '',
      question_type: type,
      marks: 5,
      order: exam.questions.length + 1,
      answers: type === 'multiple' ? [
        { answer_text: '', is_correct: false, order: 1 },
        { answer_text: '', is_correct: false, order: 2 },
        { answer_text: '', is_correct: false, order: 3 },
        { answer_text: '', is_correct: false, order: 4 }
      ] : []
    }

    if (type === 'true_false') {
      newQuestion.correct_answer = 'true'
    }

    setExam(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
      total_questions: prev.questions.length + 1
    }))
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setExam(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i === index) {
          const updatedQuestion = { ...q, [field]: value }
          
          // Auto-initialize answer options for question types that need them
          if (field === 'question_type') {
            const needsOptions = ['multiple', 'math', 'chemistry', 'physics', 'biology', 'comprehension'].includes(value)
            const hadOptions = ['multiple', 'math', 'chemistry', 'physics', 'biology', 'comprehension'].includes(q.question_type || '')
            
            if (needsOptions && !hadOptions && (!updatedQuestion.answers || updatedQuestion.answers.length === 0)) {
              // Add default answer options for new question types
              updatedQuestion.answers = [
                { answer_text: '', is_correct: true, order: 0 },
                { answer_text: '', is_correct: false, order: 1 },
                { answer_text: '', is_correct: false, order: 2 },
                { answer_text: '', is_correct: false, order: 3 }
              ]
            } else if (!needsOptions && hadOptions) {
              // Clear answer options for question types that don't need them
              updatedQuestion.answers = []
            }
          }
          
          return updatedQuestion
        }
        return q
      })
    }))
  }

  const addAnswerOption = (questionIndex: number) => {
    const newAnswer: AnswerOption = {
      answer_text: '',
      is_correct: false,
      order: exam.questions[questionIndex].answers?.length || 0
    }

    setExam(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === questionIndex 
          ? { ...q, answers: [...(q.answers || []), newAnswer] }
          : q
      )
    }))
  }

  const updateAnswerOption = (questionIndex: number, answerIndex: number, field: keyof AnswerOption, value: any) => {
    setExam(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i === questionIndex) {
          return {
            ...q,
            answers: q.answers?.map((a, j) => 
              j === answerIndex ? { ...a, [field]: value } : a
            ) || []
          }
        }
        return q
      })
    }))
  }

  const removeQuestion = (index: number) => {
    setExam(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
      total_questions: prev.questions.length - 1
    }))
  }

  const removeAnswerOption = (questionIndex: number, answerIndex: number) => {
    setExam(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i === questionIndex) {
          return {
            ...q,
            answers: q.answers?.filter((_, j) => j !== answerIndex) || []
          }
        }
        return q
      })
    }))
  }

  const setCorrectAnswer = (questionIndex: number, answerIndex: number) => {
    setExam(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i === questionIndex) {
          return {
            ...q,
            answers: q.answers?.map((a, j) => ({
              ...a,
              is_correct: j === answerIndex
            })) || []
          }
        }
        return q
      })
    }))
  }

  const handleDiagramUpload = async (questionIndex: number, file: File) => {
    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await api.post(
        `/exams/upload-diagram/`,
        formData
      )

      updateQuestion(questionIndex, 'diagram_image', response.data.filename)
      toast.success('Diagram uploaded successfully')
    } catch (error) {
      toast.error('Failed to upload diagram')
    }
  }

  const saveExam = async (publish: boolean = false) => {
    if (!exam.title.trim()) {
      toast.error('Exam title is required')
      return
    }

    if (!exam.category) {
      toast.error('Please select a category')
      return
    }

    if (exam.questions.length === 0) {
      toast.error('Add at least one question')
      return
    }

    setSaving(true)
    try {
      // Step 1: Save exam details
      const endpoint = exam.id ? `/exams/${exam.id}/` : '/exams/'
      const method = exam.id ? 'put' : 'post'
      
      const examData = {
        title: exam.title,
        category_id: exam.category ? parseInt(exam.category) : null,
        description: exam.description,
        instructions: exam.instructions,
        duration_minutes: exam.duration_minutes,
        passing_score: exam.passing_score,
        start_date: exam.start_date,
        end_date: exam.end_date,
        show_answers: true,
        show_score: true,
        shuffle_questions: true,
        shuffle_options: true,
        allow_review: true,
        total_questions: exam.total_questions,
        difficulty_level: exam.difficulty_level,
        status: publish ? 'published' : 'draft'
      }

      console.log('DEBUG FRONTEND: endpoint =', endpoint)
      console.log('DEBUG FRONTEND: method =', method)
      console.log('DEBUG FRONTEND: API_URL =', process.env.NEXT_PUBLIC_API_URL)
      console.log('DEBUG FRONTEND: full URL =', `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`)
      console.log('DEBUG FRONTEND: examData =', examData)

      const response = await (method === 'put' 
        ? api.put(endpoint, examData) 
        : api.post(endpoint, examData))

      const examId = exam.id || response.data.id
      console.log('DEBUG FRONTEND: Exam saved with ID:', examId)

      // Step 2: Save questions using bulk endpoint
      if (exam.questions.length > 0) {
        const questionsData = exam.questions.map((q, index) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          marks: q.marks,
          order: index,
          correct_answer: q.correct_answer,
          latex_content: q.latex_content,
          diagram_image: q.diagram_image,
          equation_type: q.equation_type,
          explanation: q.explanation,
          comprehension_passage: q.comprehension_passage,
          comprehension_group: q.comprehension_group,
          answers: q.answers?.map(a => ({
            answer_text: a.answer_text,
            is_correct: a.is_correct,
            order: a.order
          })) || []
        }))

        console.log('DEBUG FRONTEND: Saving questions:', questionsData)

        const questionsResponse = await api.post(
          `/exams/${examId}/questions/bulk/`,
          questionsData
        )

        console.log('DEBUG FRONTEND: Questions saved:', questionsResponse.data)
      }

      if (!exam.id) {
        setExam(prev => ({ ...prev, id: examId }))
      }

      toast.success(`Exam ${publish ? 'published' : 'saved'} successfully!`)
    } catch (error: any) {
      console.error('DEBUG FRONTEND: Save error:', error)
      toast.error(error.response?.data?.message || 'Failed to save exam')
    } finally {
      setSaving(false)
    }
  }

  const getQuestionIcon = (type: Question['question_type']) => {
    switch (type) {
      case 'math': return <Calculator className="w-4 h-4" />
      case 'chemistry': return <FlaskConical className="w-4 h-4" />
      case 'physics': return <Atom className="w-4 h-4" />
      case 'biology': return <Dna className="w-4 h-4" />
      case 'comprehension': return <BookOpen className="w-4 h-4" />
      default: return <Type className="w-4 h-4" />
    }
  }

  const renderQuestionEditor = (question: Question, qIndex: number) => {
    return (
      <div key={qIndex} className="border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getQuestionIcon(question.question_type)}
            <select
              value={question.question_type}
              onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
              className="text-sm font-medium text-gray-700 border border-gray-300 rounded"
            >
              <option value="multiple">Multiple Choice</option>
              <option value="true_false">True/False</option>
              <option value="fill_blank">Fill in Blank</option>
              <option value="short">Short Answer</option>
              <option value="math">Mathematical</option>
              <option value="chemistry">Chemistry</option>
              <option value="physics">Physics</option>
              <option value="biology">Biology</option>
              <option value="comprehension">Comprehension</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={question.marks}
              onChange={(e) => updateQuestion(qIndex, 'marks', parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
              placeholder="Marks"
            />
            <button
              onClick={() => removeQuestion(qIndex)}
              className="p-1 text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Question Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
          {question.question_type === 'math' || question.question_type === 'chemistry' ? (
            <div className="space-y-2">
              <textarea
                value={question.question_text || ''}
                onChange={(e) => updateQuestion(qIndex, 'question_text', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Enter question text (no LaTeX)"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {question.question_type === 'math' ? 'LaTeX Content' : 'Chemical Equation'}
                </label>
                <textarea
                  value={question.latex_content || ''}
                  onChange={(e) => updateQuestion(qIndex, 'latex_content', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  rows={3}
                  placeholder={question.question_type === 'math' 
                    ? 'Enter LaTeX: x^2 + 5x + 6 = 0' 
                    : 'Enter chemical equation: 2H2 + O2 → 2H2O'
                  }
                />
              </div>
            </div>
          ) : (
            <textarea
              value={question.question_text || ''}
              onChange={(e) => updateQuestion(qIndex, 'question_text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="Enter your question"
            />
          )}
        </div>

        {/* Comprehension Passage */}
        {question.question_type === 'comprehension' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comprehension Passage</label>
            <textarea
              value={question.comprehension_passage || ''}
              onChange={(e) => updateQuestion(qIndex, 'comprehension_passage', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={4}
              placeholder="Enter the comprehension passage that students will read before answering questions..."
            />
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Passage Group (optional)</label>
              <input
                type="text"
                value={question.comprehension_group || ''}
                onChange={(e) => updateQuestion(qIndex, 'comprehension_group', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., passage_1, reading_a, etc. (questions with same group will share this passage)"
              />
              <div className="text-xs text-gray-500 mt-1">
                💡 Questions with the same group ID will share this passage. Leave empty if this is the only question for this passage.
              </div>
            </div>
          </div>
        )}

        {/* Diagram/Image Upload for ALL question types */}
        {question.question_type && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Diagram/Image</label>
            {question.diagram_image ? (
              <div className="flex items-center gap-3">
                <img 
                  src={question.diagram_image} 
                  alt="Diagram" 
                  className="h-20 w-20 object-cover rounded border border-gray-300"
                />
                <button
                  onClick={() => updateQuestion(qIndex, 'diagram_image', '')}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleDiagramUpload(qIndex, file)
                }}
                className="w-full"
              />
            )}
          </div>
        )}

        {/* Answer Options */}
        {(['multiple', 'math', 'chemistry', 'physics', 'biology', 'comprehension'].includes(question.question_type || '')) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer Options {question.question_type === 'math' || question.question_type === 'chemistry' || question.question_type === 'physics' ? '(supports LaTeX)' : ''}
            </label>
            <div className="space-y-2">
              {question.answers?.map((answer, aIndex) => (
                <div key={aIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={answer.is_correct}
                    onChange={() => setCorrectAnswer(qIndex, aIndex)}
                    className="text-primary-600"
                  />
                  <input
                    type="text"
                    value={answer.answer_text || ''}
                    onChange={(e) => updateAnswerOption(qIndex, aIndex, 'answer_text', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded"
                    placeholder={`Option ${aIndex + 1}${question.question_type === 'math' || question.question_type === 'chemistry' ? ' (e.g., $x^2$ or H₂O)' : ''}`}
                  />
                  <button
                    onClick={() => removeAnswerOption(qIndex, aIndex)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addAnswerOption(qIndex)}
                className="flex items-center gap-2 px-3 py-2 text-primary-600 hover:text-primary-700 border border-primary-300 rounded"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
              {(question.question_type === 'math' || question.question_type === 'chemistry') && (
                <div className="text-xs text-gray-500 mt-1">
                  💡 Tip: Use LaTeX for math: $x^2 + y^2 = z^2$ or chemical formulas: H₂O, CO₂, →, ⇌
                </div>
              )}
            </div>
          </div>
        )}

        {/* True/False */}
        {question.question_type === 'true_false' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`tf-${qIndex}`}
                  checked={question.correct_answer === 'true'}
                  onChange={() => updateQuestion(qIndex, 'correct_answer', 'true')}
                  className="text-primary-600"
                />
                <span>TRUE</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`tf-${qIndex}`}
                  checked={question.correct_answer === 'false'}
                  onChange={() => updateQuestion(qIndex, 'correct_answer', 'false')}
                  className="text-primary-600"
                />
                <span>FALSE</span>
              </label>
            </div>
          </div>
        )}

        {/* Fill in Blank / Short Answer */}
        {(question.question_type === 'fill_blank' || question.question_type === 'short') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {question.question_type === 'fill_blank' ? 'Correct Answer' : 'Sample Answer'}
            </label>
            <textarea
              value={question.correct_answer || ''}
              onChange={(e) => updateQuestion(qIndex, 'correct_answer', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder={question.question_type === 'fill_blank' 
                ? 'Enter the correct answer' 
                : 'Enter a sample answer for reference'
              }
            />
          </div>
        )}

        {/* Explanation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
          <textarea
            value={question.explanation || ''}
            onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={2}
            placeholder="Explanation shown after exam (if enabled)"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Exam Builder</h2>
        <div className="flex gap-3">
          <button
            onClick={() => saveExam(false)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => saveExam(true)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
          >
            <Eye className="w-4 h-4" />
            {saving ? 'Publishing...' : 'Publish Exam'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'details'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Exam Details
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'questions'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Questions ({exam.questions.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Exam Title *</label>
              <input
                type="text"
                value={exam.title}
                onChange={(e) => setExam(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Enter exam title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={showCategoryForm ? '__new__' : exam.category}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '__new__') {
                    setShowCategoryForm(true)
                  } else {
                    setShowCategoryForm(false)
                    setExam(prev => ({ ...prev, category: value }))
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select category</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
                <option value="__new__">+ Create New Category...</option>
              </select>

              {showCategoryForm && (
                <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                  <p className="text-sm font-medium text-gray-700">New Category</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Category name (e.g., English)"
                    />
                    <input
                      type="text"
                      value={newCategoryCode}
                      onChange={(e) => setNewCategoryCode(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Code (e.g., ENG101)"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={createCategory}
                      disabled={creatingCategory}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                    >
                      {creatingCategory ? 'Creating...' : 'Create Category'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryForm(false)
                        setNewCategoryName('')
                        setNewCategoryCode('')
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={exam.description}
                onChange={(e) => setExam(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Exam description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
              <textarea
                value={exam.instructions}
                onChange={(e) => setExam(prev => ({ ...prev, instructions: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Instructions for students"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
              <input
                type="number"
                value={exam.duration_minutes}
                onChange={(e) => setExam(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min="5"
                max="480"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Passing Score (%)</label>
              <input
                type="number"
                value={exam.passing_score}
                onChange={(e) => setExam(prev => ({ ...prev, passing_score: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min="0"
                max="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
              <select
                value={exam.difficulty_level}
                onChange={(e) => setExam(prev => ({ ...prev, difficulty_level: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={exam.status}
                onChange={(e) => setExam(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="datetime-local"
                value={exam.start_date}
                onChange={(e) => setExam(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="datetime-local"
                value={exam.end_date}
                onChange={(e) => setExam(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Add Question Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => addQuestion('multiple')}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Multiple Choice
            </button>
            <button
              onClick={() => addQuestion('true_false')}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              True/False
            </button>
            <button
              onClick={() => addQuestion('fill_blank')}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Fill Blank
            </button>
            <button
              onClick={() => addQuestion('short')}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Short Answer
            </button>
            <button
              onClick={() => addQuestion('math')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg"
            >
              <Calculator className="w-4 h-4" />
              Math Question
            </button>
            <button
              onClick={() => addQuestion('chemistry')}
              className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Chemistry
            </button>
            <button
              onClick={() => addQuestion('physics')}
              className="flex items-center gap-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Physics
            </button>
            <button
              onClick={() => addQuestion('biology')}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg"
            >
              <Dna className="w-4 h-4" />
              Biology
            </button>
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {exam.questions.map((question, index) => renderQuestionEditor(question, index))}
          </div>
        </div>
      )}
    </div>
  )
}
