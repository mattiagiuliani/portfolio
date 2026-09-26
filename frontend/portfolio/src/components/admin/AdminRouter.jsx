'use client'

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Suspense } from 'react'
import { AuthProvider } from '../../context/AuthContext.jsx'
import AdminLayout from './AdminLayout'
import ProtectedRoute from './ProtectedRoute'
import Login from '../../_pages/admin/Login'
import AdminHome from '../../_pages/admin/AdminHome'
import AdminMessages from '../../_pages/admin/AdminMessages'
import AdminBlog from '../../_pages/admin/AdminBlog'
import AdminProjects from '../../_pages/admin/AdminProjects'
import AdminSettings from '../../_pages/admin/AdminSettings'

export default function AdminRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
          <Routes>
            <Route path="/admin/login" element={<Login />} />
            <Route
              path="/admin/*"
              element={(
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              )}
            >
              <Route index element={<AdminHome />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}