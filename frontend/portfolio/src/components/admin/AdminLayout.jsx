import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
    <div className="min-h-dvh bg-bg flex">
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

        {/* Page content with per-route fade transition */}
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
