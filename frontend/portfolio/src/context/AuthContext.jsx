import { useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/adminApi'
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
    try {
      const res = await authApi.getMe()
      setUser(res.user)
    } catch {
      setUser(null) // 401 → not authenticated, no error to surface
    } finally {
      setLoading(false)
    }
  }, [])

  // Run once on app boot to restore session
  useEffect(() => { checkAuth() }, [checkAuth])

  const login = async (email, password) => {
    const res = await authApi.login(email, password)
    setUser(res.user)
    return res
  }

  const logout = async () => {
    await authApi.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}
