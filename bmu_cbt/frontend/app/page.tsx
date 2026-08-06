'use client'

import { useAuth } from '@/contexts/AuthContext'
import LoginForm from '@/components/auth/LoginForm'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useEffect } from 'react'

export default function Home() {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.href = mustChangePassword ? '/change-password' : '/dashboard'
    }
  }, [isAuthenticated, isLoading, mustChangePassword])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <img 
              src="/favicon.ico" 
              alt="BMU CBT Logo" 
              className="h-full w-full object-contain animate-pulse"
            />
          </div>
          <LoadingSpinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <img 
            src="/favicon.ico" 
            alt="BMU CBT Logo" 
            className="h-full w-full object-contain animate-pulse"
          />
        </div>
        <LoadingSpinner className="w-8 h-8 mx-auto mb-4" />
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}
