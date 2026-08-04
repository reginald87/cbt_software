'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from './Sidebar'
import Header from './Header'
import Overview from './Overview'
import ExamsList from './ExamsList'
import Results from './Results'
import Profile from './Profile'
import BulkImport from './BulkImport'
import BulkStudentUpload from './BulkStudentUpload'
import AdminTools from './AdminTools'
import AdminExamReview from './AdminExamReview'
import TakeExam from './TakeExam'
import StudentDashboard from './StudentDashboard'
import ExamMonitor from './ExamMonitor'
import SecurityDashboard from './SecurityDashboard'
import ExamBuilder from './ExamBuilder'
import AnalyticsDashboard from './AnalyticsDashboard'
import LoadingSpinner from './LoadingSpinner'
import EmptyState from './EmptyState'
import ErrorBoundary from './ErrorBoundary'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [activeExamSession, setActiveExamSession] = useState<{ examId: number; attemptId: number } | null>(null)
  const [editingExamId, setEditingExamId] = useState<number | null>(null)
  const { user, logout } = useAuth()

  if (user && !user.is_superuser) {
    return <StudentDashboard />
  }

  const renderContent = () => {
    return (
      <ErrorBoundary>
        <div className="p-6">
          {(() => {
            switch (activeTab) {
              case 'overview':
                return <Overview />
              case 'exams':
                return (
                  <ExamsList
                    onExamStarted={(examId, attemptId) => {
                      setActiveExamSession({ examId, attemptId })
                      setActiveTab('take-exam')
                    }}
                    onEditExam={(examId) => {
                      setEditingExamId(examId)
                      setActiveTab('exam-builder')
                    }}
                  />
                )
              case 'results':
                return <Results />
              case 'profile':
                return <Profile />
              case 'bulk-import':
                return <BulkImport />
              case 'bulk-upload':
                return <BulkStudentUpload />
              case 'exam-builder':
                return <ExamBuilder examId={editingExamId} />
              case 'admin-tools':
                return <AdminTools />
              case 'exam-monitor':
                return <ExamMonitor />
              case 'security-dashboard':
                return <SecurityDashboard />
              case 'review-exams':
                return <AdminExamReview />
              case 'analytics':
                return <AnalyticsDashboard />
              case 'take-exam':
                return activeExamSession ? (
                  <TakeExam
                    examId={activeExamSession.examId}
                    attemptId={activeExamSession.attemptId}
                    onExit={() => {
                      setActiveExamSession(null)
                      setActiveTab('exams')
                    }}
                  />
                ) : (
                  <Overview />
                )
              default:
                return <Overview />
            }
          })()}
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col">
        <Header user={user} onLogout={logout} />
        
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
