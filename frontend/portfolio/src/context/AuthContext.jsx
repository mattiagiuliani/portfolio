import { useState, useEffect, useCallback, useRef } from 'react'
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
  const authRequestId = useRef(0)

  const checkAuth = useCallback(async () => {
    const requestId = ++authRequestId.current

    try {
      const res = await authApi.getMe()
      if (requestId === authRequestId.current) setUser(res.user)
    } catch {
      if (requestId === authRequestId.current) setUser(null) // 401 → not authenticated, no error to surface
    } finally {
      if (requestId === authRequestId.current) setLoading(false)
    }
  }, [])

  // Run once on app boot to restore session
  useEffect(() => { checkAuth() }, [checkAuth])

  const login = async (email, password) => {
    ++authRequestId.current
    const res = await authApi.login(email, password)
    setUser(res.user)
    setLoading(false)
    return res
  }

  const logout = async () => {
    ++authRequestId.current
    await authApi.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}
