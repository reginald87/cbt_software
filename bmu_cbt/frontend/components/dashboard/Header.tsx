'use client'

import { User, LogOut, Settings } from 'lucide-react'

interface HeaderProps {
  user: any
  onLogout: () => void
}

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and title */}
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 flex items-center justify-center">
              <img 
                src="/favicon.ico" 
                alt="BMU CBT Logo" 
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Settings */}
            <button className="p-2 text-gray-400 hover:text-gray-500">
              <Settings className="h-5 w-5" />
            </button>

            {/* User menu */}
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{user?.user_type}</p>
              </div>
              
              <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-gray-400 hover:text-gray-500"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
