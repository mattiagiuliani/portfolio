'use client'

import dynamic from 'next/dynamic'

// BrowserRouter requires window/document; the private SPA must not execute SSR.
const AdminRouter = dynamic(() => import('./AdminRouter'), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-bg" role="status">Loading admin…</div>,
})

export default AdminRouter
