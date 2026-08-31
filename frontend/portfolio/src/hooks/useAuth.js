import { useContext } from 'react'
import { AuthContext } from '../context/authContext'

/**
 * useAuth — consume the AuthContext from any component.
 * Throws a clear error if used outside <AuthProvider> to catch
 * misconfiguration early.
 *
 * Returns: { user, loading, login, logout, checkAuth }
 */
function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be called inside <AuthProvider>')
  return ctx
}

export default useAuth
