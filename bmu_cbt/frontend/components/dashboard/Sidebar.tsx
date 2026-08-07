'use client'

import { useState } from 'react'
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  BarChart3, 
  User, 
  Upload, 
  Users, 
  Settings, 
  Monitor, 
  Shield,
  Edit3,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
  Activity,
  TrendingUp,
  History
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, logout } = useAuth()

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'exams', label: 'Exams', icon: BookOpen },
    { id: 'exam-builder', label: 'Exam Builder', icon: Edit3 },
    { id: 'results', label: 'Results', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'bulk-import', label: 'Bulk Import', icon: Upload },
    { id: 'bulk-upload', label: 'Bulk Student Upload', icon: Users },
    { id: 'exam-monitor', label: 'Exam Monitor', icon: Activity },
    { id: 'security-dashboard', label: 'Security Dashboard', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'admin-tools', label: 'Admin Tools', icon: Settings },
    { id: 'review-exams', label: 'Review Exams', icon: ClipboardCheck },
    { id: 'audit-logs', label: 'Audit Logs', icon: History },
  ].filter((item) => {
    if (item.id === 'bulk-import' || item.id === 'review-exams' || item.id === 'bulk-upload' || item.id === 'admin-tools' || item.id === 'exam-monitor' || item.id === 'security-dashboard' || item.id === 'exam-builder' || item.id === 'analytics' || item.id === 'audit-logs') {
      return !!user?.is_superuser
    }
    return true
  })

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6 text-gray-600" />
          ) : (
            <Menu className="w-6 h-6 text-gray-600" />
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:transform-none ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 flex items-center justify-center">
                <img 
                  src="/favicon.ico" 
                  alt="BMU CBT Logo" 
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-bold text-gray-900">BMU CBT</h1>
                <p className="text-xs text-gray-500">Admin Panel</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    setIsMobileMenuOpen(false)
                  }}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-xs text-gray-500">{user?.user_type}</p>
              </div>
            </div>
            <button
              onClick={async () => {
                await logout()
                window.location.href = '/login'
              }}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
