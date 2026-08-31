import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { lazy, Suspense, useEffect, useState } from 'react'
import { portfolioApi } from './services/api'

// ─── Public portfolio ──────────────────────────────────────────────────────────
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import ScrollToLocation from './components/layout/ScrollToLocation'
import Hero from './sections/Hero'
import About from './sections/About'
import Skills from './sections/Skills'
import Projects from './sections/Projects'
import Contact from './sections/Contact'
import BlogPreview from './sections/BlogPreview'
const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))

// ─── Admin ─────────────────────────────────────────────────────────────────────
import AdminLayout from './components/admin/AdminLayout'
import ProtectedRoute from './components/admin/ProtectedRoute'
const Login = lazy(() => import('./pages/admin/Login'))
const AdminHome = lazy(() => import('./pages/admin/AdminHome'))
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'))
const AdminBlog = lazy(() => import('./pages/admin/AdminBlog'))
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))

function HomePage() {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let active = true
    portfolioApi.fetchSettings()
      .then((res) => { if (active) setSettings(res.data) })
      .catch(() => {})

    return () => { active = false }
  }, [])
  return (
    <>
      <Hero settings={settings} />
      <About settings={settings} />
      <Skills />
      <Projects />
      <BlogPreview />
      <Contact settings={settings} />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
        <Routes>
        {/* ── Public portfolio (Navbar + Footer) ─────────────────────────────── */}
        <Route
          path="/*"
          element={
            <>
              <Navbar />
              <ScrollToLocation />
              <main>
                <Routes>
                  <Route path="/"           element={<HomePage />} />
                  <Route path="/blog"       element={<Blog />} />
                  <Route path="/blog/:slug" element={<BlogPost />} />
                </Routes>
              </main>
              <Footer />
            </>
          }
        />

        {/* ── Admin login (no Navbar/Footer) ─────────────────────────────────── */}
        <Route path="/admin/login" element={<Login />} />

        {/* ── Protected admin area ───────────────────────────────────────────── */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index              element={<AdminHome />} />
          <Route path="messages"   element={<AdminMessages />} />
          <Route path="blog"       element={<AdminBlog />} />
          <Route path="projects"   element={<AdminProjects />} />
          <Route path="settings"   element={<AdminSettings />} />
        </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
