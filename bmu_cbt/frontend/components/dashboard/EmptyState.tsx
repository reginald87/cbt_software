'use client'

import { FileText, Users, BookOpen, AlertCircle } from 'lucide-react'

interface EmptyStateProps {
  type: 'exams' | 'results' | 'students' | 'general'
  title?: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ type, title, description, action }: EmptyStateProps) {
  const getDefaultContent = () => {
    switch (type) {
      case 'exams':
        return {
          icon: BookOpen,
          title: title || 'No Exams Available',
          description: description || 'There are no exams scheduled at the moment. Check back later or contact your administrator.'
        }
      case 'results':
        return {
          icon: FileText,
          title: title || 'No Results Found',
          description: description || 'No exam results are available yet. Take an exam to see your results here.'
        }
      case 'students':
        return {
          icon: Users,
          title: title || 'No Students Found',
          description: description || 'No students match the current criteria. Try adjusting your filters.'
        }
      default:
        return {
          icon: AlertCircle,
          title: title || 'No Data Available',
          description: description || 'There is no data to display at this time.'
        }
    }
  }

  const { icon: Icon, title: defaultTitle, description: defaultDescription } = getDefaultContent()

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {defaultTitle}
      </h3>
      <p className="text-gray-600 text-center mb-6 max-w-md">
        {defaultDescription}
      </p>
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  )
}
