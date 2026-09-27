import { useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/adminApi'
import { advanceAuthGeneration, isCurrentAuthGeneration } from '../services/authGeneration.js'
import { AuthContext } from './authContext'


/**
 * AuthProvider — wraps the app and exposes the auth state globally.
 *
 * On mount, it silently calls /api/auth/me to restore a session from
 * the existing HTTP-only cookie. Components stay in a loading state
 * until the check resolves, preventing flash of un-authenticated content.
 */
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    const generation = advanceAuthGeneration()

    try {
      const res = await authApi.getMe()
      if (isCurrentAuthGeneration(generation)) setUser(res.user)
    } catch {
      if (isCurrentAuthGeneration(generation)) setUser(null) // 401 → not authenticated, no error to surface
    } finally {
      if (isCurrentAuthGeneration(generation)) setLoading(false)
    }
  }, [])

  // Run once on app boot to restore session
  useEffect(() => { checkAuth() }, [checkAuth])
  useEffect(() => {
    const expired = (event) => {
      if (!isCurrentAuthGeneration(event.detail?.generation)) return
      advanceAuthGeneration()
      setUser(null)
      setLoading(false)
    }
    window.addEventListener('admin-session-expired', expired)
    return () => window.removeEventListener('admin-session-expired', expired)
  }, [])

  const login = async (email, password) => {
    const generation = advanceAuthGeneration()
    const res = await authApi.login(email, password)
    if (isCurrentAuthGeneration(generation)) {
      // Requests started while login was pending also predate this session.
      advanceAuthGeneration()
      setUser(res.user)
      setLoading(false)
    }
    return res
  }

  const logout = async () => {
    const generation = advanceAuthGeneration()
    await authApi.logout()
    if (isCurrentAuthGeneration(generation)) {
      advanceAuthGeneration()
      setUser(null)
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}
