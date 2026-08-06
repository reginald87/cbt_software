'use client'

import { useAuth } from '@/contexts/AuthContext'
import Dashboard from '@/components/dashboard/Dashboard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function DashboardPage() {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    window.location.href = '/'
    return null
  }

  if (mustChangePassword) {
    // Force first-login password change before allowing dashboard access
    window.location.href = '/change-password'
    return null
  }

  return <Dashboard />
}
