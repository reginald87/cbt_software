import { getApiUrl } from '@/config/api'
import Cookies from 'js-cookie'

type CustomRequestInit = RequestInit & { 
  method?: string
  params?: Record<string, string | number | boolean | undefined>
  responseType?: 'json' | 'blob' | 'arrayBuffer' | 'text'
  _retried?: boolean
}

interface ApiResponse<T = any> {
  data: any
  status: number
  statusText: string
  headers: Headers
}

interface ApiError extends Error {
  response?: {
    status: number
    data?: any
    statusText: string
  }
}

// Create a fetch-based API client to avoid axios Node.js module issues
const api: {
  request<T>(url: string, options?: CustomRequestInit): Promise<ApiResponse<T>>
  get<T>(url: string, options?: CustomRequestInit): Promise<ApiResponse<T>>
  post<T>(url: string, data?: any, options?: CustomRequestInit): Promise<ApiResponse<T>>
  put<T>(url: string, data?: any, options?: CustomRequestInit): Promise<ApiResponse<T>>
  patch<T>(url: string, data?: any, options?: CustomRequestInit): Promise<ApiResponse<T>>
  delete<T>(url: string, options?: CustomRequestInit): Promise<ApiResponse<T>>
} = {
  async request<T = any>(
    url: string,
    options: CustomRequestInit = {}
  ): Promise<ApiResponse<T>> {
    const baseURL = getApiUrl()
    let fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`
    
    if (options.params) {
      const searchParams = new URLSearchParams()
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString
      }
    }
    
    const token = Cookies.get('access_token')
    const headers = new Headers(options.headers || {})
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    
    if (options.body && typeof options.body === 'object') {
      headers.set('Content-Type', 'application/json')
    }

    const { params, responseType = 'json', ...fetchOptions } = options
    try {
      const response = await fetch(fullUrl, {
        ...fetchOptions,
        headers,
      })

      let data
      try {
        switch (responseType) {
          case 'blob':
            data = await response.blob()
            break
          case 'arrayBuffer':
            data = await response.arrayBuffer()
            break
          case 'text':
            data = await response.text()
            break
          default:
            data = await response.json()
        }
      } catch {
        data = null
      }

      if (!response.ok) {
        // Handle 401 - try to refresh token
        if (response.status === 401 && !options._retried) {
          const refreshToken = Cookies.get('refresh_token')
          if (refreshToken) {
            options._retried = true
            try {
              const refreshResponse = await fetch(`${baseURL}/auth/refresh/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${refreshToken}`,
                },
              })

              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json()
                const newAccessToken = refreshData.access
                Cookies.set('access_token', newAccessToken, { expires: 1 })

                // Retry original request with new token
                return this.request(url, options)
              }
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError)
            }
          }
        }

        if (response.status === 401) {
          // Refresh failed, clear tokens
          Cookies.remove('access_token')
          Cookies.remove('refresh_token')
          
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
        }

        const error: ApiError = new Error(data?.detail || data?.message || response.statusText || 'API request failed')
        error.response = {
          status: response.status,
          data,
          statusText: response.statusText,
        }
        throw error
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }
    } catch (error) {
      if (error instanceof Error && 'response' in error) {
        throw error
      }
      throw new Error(error instanceof Error ? error.message : 'Network request failed')
    }
  },

  get(url: string, options?: CustomRequestInit): Promise<ApiResponse> {
    return this.request(url, { ...options, method: 'GET' })
  },

  post(url: string, data?: any, options?: CustomRequestInit): Promise<ApiResponse> {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  put(url: string, data?: any, options?: CustomRequestInit): Promise<ApiResponse> {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  patch(url: string, data?: any, options?: CustomRequestInit): Promise<ApiResponse> {
    return this.request(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  delete(url: string, options?: CustomRequestInit): Promise<ApiResponse> {
    return this.request(url, { ...options, method: 'DELETE' })
  },
}

export default api

