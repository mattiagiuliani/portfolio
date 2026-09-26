import PublicationStatus from './PublicationStatus'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

/** Map route paths to human-readable page titles shown in the top bar */
const pageTitles = {
  '/admin':           'Dashboard',
  '/admin/messages':  'Messages',
  '/admin/blog':      'Blog',
  '/admin/projects':  'Projects',
  '/admin/settings':  'Settings',
}

function AdminLayout() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? 'Admin'

  return (
    <div className="admin-shell min-h-dvh bg-bg flex">
      <Sidebar />

      {/* Main content — offset by sidebar width */}
      <div className="flex-1 flex flex-col ml-14 sm:ml-56 min-h-dvh min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-8 py-4 bg-bg/80 backdrop-blur-sm border-b border-white/5">
          <h1 className="text-sm font-semibold text-white">{title}</h1>
          <span className="text-xs font-mono text-muted">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </header>

        {/* Keep the route outlet stable so navigation cannot reset form input. */}
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
          <PublicationStatus />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
