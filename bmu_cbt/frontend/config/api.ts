// Detect API URL at runtime from the current browser address.
// Both Django (8000) and Next.js (3000) run on the same server,
// so we derive the API host from window.location and hardcode port 8000.
// This means the frontend works with ANY server IP — no rebuild needed.

export const getApiUrl = (): string => {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'
  }

  // Runtime: use the current browser hostname with port 8000
  return `http://${window.location.hostname}:8000/api`
}

export const API_URL = getApiUrl()
