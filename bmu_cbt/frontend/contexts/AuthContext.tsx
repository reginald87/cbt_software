'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import Cookies from 'js-cookie'
import api from '@/utils/axios'
import toast from 'react-hot-toast'
import { getApiUrl } from '@/config/api'

interface User {
  id: number
  username: string
  email: string
  full_name?: string
  first_name?: string
  last_name?: string
  user_type: string
  department?: string | null
  matric_number?: string | null
  jamb_number?: string | null
  profile_picture?: string | null
  is_superuser?: boolean
  is_staff?: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<{ success: boolean; mustChangePassword: boolean; errorMessage?: string }>
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
  mustChangePassword: boolean
  clearMustChangePassword: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => {
    const savedToken = Cookies.get('access_token')
    if (savedToken) {
      setToken(savedToken)
      // Verify token and get user info
      verifyToken(savedToken)
    } else {
      setIsLoading(false)
    }
  }, [])

  const verifyToken = async (accessToken: string) => {
    try {
      const apiUrl = getApiUrl()
      const response = await api.get('/auth/profile/')
      
      setUser(response.data)
      setMustChangePassword(!!response.data.must_change_password)
      setIsLoading(false)
    } catch (error: any) {
      console.error('Token verification failed:', error)

      // If token expired, try to refresh
      if (error.response?.status === 401) {
        const refreshSuccess = await refreshToken()
        if (!refreshSuccess) {
          console.log('Token refresh failed, user needs to login again')
        }
      } else {
        // Network or server error - keep the existing session and let the
        // axios interceptor handle real auth expiry. Clearing the tokens here
        // would log out valid students on a transient hiccup (e.g. a 500).
        console.error('Could not verify session (non-auth error):', error)
        setIsLoading(false)
      }
    }
  }

  const login = async (username: string, password: string): Promise<{ success: boolean; mustChangePassword: boolean; errorMessage?: string }> => {
    setIsLoading(true)
    
    try {
      const apiUrl = getApiUrl()
      const response = await api.post('/auth/login/', {
        username,
        password,
      })

      const { access, refresh, ...userData } = response.data
      
      // Save tokens
      Cookies.set('access_token', access, { expires: 1 }) // 1 day
      Cookies.set('refresh_token', refresh, { expires: 7 }) // 7 days
      
      setToken(access)
      setUser({
        id: userData.user_id,
        username: userData.username,
        email: userData.email,
        full_name: userData.full_name,
        user_type: userData.user_type,
        profile_picture: userData.profile_picture,
        is_superuser: userData.is_superuser,
        is_staff: userData.is_staff,
      })

      const changeRequired = !!userData.must_change_password
      setMustChangePassword(changeRequired)
      
      toast.success('Login successful!')
      setIsLoading(false)
      return { success: true, mustChangePassword: changeRequired }
    } catch (error: any) {
      console.error('Login failed:', error)
      const errorMessage = error.response?.data?.detail || 'Login failed. Please try again.'
      setIsLoading(false)
      return { success: false, mustChangePassword: false, errorMessage }
    }
  }

  const refreshToken = async () => {
    const refreshToken = Cookies.get('refresh_token')
    if (!refreshToken) {
      return false
    }
    
    try {
      // Use raw fetch with the refresh token in the header (the api client
      // would inject the access token instead, which /auth/refresh/ rejects)
      const response = await fetch(`${getApiUrl()}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Refresh failed')
      }

      const data = await response.json()
      const newAccessToken = data.access
      Cookies.set('access_token', newAccessToken, { expires: 1 })
      setToken(newAccessToken)
      
      // Verify the new token
      await verifyToken(newAccessToken)
      return true
    } catch (error) {
      console.error('Token refresh failed:', error)
      // Clear all tokens on refresh failure
      Cookies.remove('access_token')
      Cookies.remove('refresh_token')
      setToken(null)
      setUser(null)
      setIsLoading(false)
      return false
    }
  }

  const logout = () => {
    Cookies.remove('access_token')
    Cookies.remove('refresh_token')
    setToken(null)
    setUser(null)
    setMustChangePassword(false)
    toast.success('Logged out successfully')
  }

  const clearMustChangePassword = () => {
    setMustChangePassword(false)
  }

  const value = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
    mustChangePassword,
    clearMustChangePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
