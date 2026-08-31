import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

/**
 * ProtectedRoute — wraps any admin route.
 *
 * While the auth check is in flight (app boot): shows a centered spinner.
 * If no valid session: redirects to /admin/login, preserving the intended URL
 * in location.state so the login page can redirect back after success.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg">
        <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
