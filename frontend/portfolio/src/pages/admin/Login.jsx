import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import useAuth from '../../hooks/useAuth'
import { fadeUp, staggerContainer } from '../../lib/motion'

function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  // Redirect back to wherever the user was trying to reach, default to /admin
  const from = location.state?.from?.pathname ?? '/admin'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.message ?? 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center px-4">
      <motion.div
        variants={staggerContainer(0.08, 0.1)}
        initial="hidden"
        animate="show"
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <motion.div variants={fadeUp} className="mb-8 text-center">
          <p className="text-2xl font-extrabold text-white tracking-tight">
            MG<span className="text-primary">.</span>
          </p>
          <p className="mt-1.5 text-xs font-mono text-muted tracking-widest uppercase">
            Admin Console
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          variants={fadeUp}
          className="bg-surface border border-white/8 rounded-2xl p-8"
        >
          <h1 className="text-xl font-bold text-white mb-1">Sign in</h1>
          <p className="text-sm text-muted mb-7">Enter your admin credentials to continue</p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-xs font-mono text-muted mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                className="w-full bg-bg border border-white/8 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-subtle focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-200"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-mono text-muted mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-bg border border-white/8 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-subtle focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-200"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-mono text-red-400 bg-red-400/8 border border-red-400/15 rounded-lg px-3.5 py-2.5"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-1 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </motion.div>

        <motion.p
          variants={fadeUp}
          className="mt-6 text-center text-xs font-mono text-subtle"
        >
          Portfolio Admin · {new Date().getFullYear()}
        </motion.p>
      </motion.div>
    </div>
  )
}

export default Login
