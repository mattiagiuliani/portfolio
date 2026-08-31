import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { projectsApi } from '../../services/adminApi'
import { staggerContainer, fadeUp } from '../../lib/motion'
import ProjectFormModal from '../../components/admin/ProjectFormModal'

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.5 8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)
const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 2l1.5 3 3.5.5L9.5 8l.5 3.5L7 10l-3 1.5.5-3.5L2.5 5.5 6 5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

function PlaceholderImage() {
  return (
    <div className="w-full aspect-video bg-surface-raised flex items-center justify-center rounded-t-xl border-b border-white/5">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="4" y="7" width="24" height="18" rx="2" stroke="#3a3a55" strokeWidth="1.5"/>
        <circle cx="11" cy="13" r="2.5" stroke="#3a3a55" strokeWidth="1.5"/>
        <path d="M4 21l6-5 5 4 4-3 9 7" stroke="#3a3a55" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function AdminProjects() {
  const [projects,   setProjects]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [editorProj, setEditorProj] = useState(undefined) // undefined=closed, null=new, obj=edit
  const [deletingId, setDeletingId] = useState(null)
  const [processing, setProcessing] = useState(new Set())

  const fetchProjects = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await projectsApi.getAll()
      setProjects(res.data)
    } catch (err) {
      setError(err?.message ?? 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const withProcessing = async (id, fn) => {
    if (processing.has(id)) return
    setProcessing((p) => new Set(p).add(id))
    try { await fn() } catch { fetchProjects() }
    finally { setProcessing((p) => { const s = new Set(p); s.delete(id); return s }) }
  }

  const handleToggleFeature = (id, current) => {
    setProjects((prev) => prev.map((p) => p._id === id ? { ...p, featured: !current } : p))
    withProcessing(id, () => projectsApi.toggleFeature(id))
  }

  const handleTogglePublished = (id, current) => {
    setProjects((prev) => prev.map((p) => p._id === id ? { ...p, published: !current } : p))
    withProcessing(id, () => projectsApi.togglePublished(id))
  }

  const handleDelete = (id) => {
    setProjects((prev) => prev.filter((p) => p._id !== id))
    setDeletingId(null)
    withProcessing(id, () => projectsApi.remove(id))
  }

  const skeletonCards = Array.from({ length: 4 })

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="max-w-5xl">

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Projects</h2>
          {!loading && (
            <p className="mt-1 text-sm text-muted font-mono">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button onClick={() => setEditorProj(null)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors duration-200">
          <PlusIcon /> Add project
        </button>
      </div>

      {error && (
        <p className="mb-4 text-xs font-mono text-red-400 bg-red-400/8 border border-red-400/15 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {skeletonCards.map((_, i) => (
            <div key={i} className="bg-surface border border-white/5 rounded-xl animate-pulse">
              <div className="w-full aspect-video bg-white/5 rounded-t-xl" />
              <div className="p-4 flex flex-col gap-2">
                <div className="h-4 w-3/4 rounded bg-white/8" />
                <div className="h-3.5 w-full rounded bg-white/5" />
                <div className="h-3.5 w-2/3 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-3xl mb-3">🗂️</p>
          <p className="text-sm font-semibold text-white mb-1">No projects yet</p>
          <p className="text-xs font-mono text-muted mb-5">Add your portfolio projects here.</p>
          <button onClick={() => setEditorProj(null)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-white transition-colors duration-200">
            Add first project
          </button>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer(0.05)} initial="hidden" animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {projects.map((proj) => {
            const isProcessing = processing.has(proj._id)
            const isDeleting   = deletingId === proj._id

            return (
              <motion.div
                key={proj._id}
                variants={fadeUp}
                className={`group bg-surface border border-white/5 rounded-xl overflow-hidden flex flex-col hover:border-white/10 transition-colors duration-200 ${isProcessing ? 'opacity-50' : ''}`}
              >
                {/* Image */}
                {proj.image
                  ? <img src={proj.image} alt={proj.title} className="w-full aspect-video object-cover" loading="lazy" />
                  : <PlaceholderImage />
                }

                {/* Content */}
                <div className="flex flex-col flex-1 p-4 gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white leading-snug line-clamp-1 flex-1">
                      {proj.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {proj.featured && (
                        <span className="text-yellow-400" title="Featured"><StarIcon /></span>
                      )}
                      <span className={`w-1.5 h-1.5 rounded-full ${proj.published ? 'bg-emerald' : 'bg-muted'}`} title={proj.published ? 'Published' : 'Hidden'} />
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-relaxed line-clamp-2 flex-1">{proj.description}</p>

                  {proj.technologies?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {proj.technologies.slice(0, 4).map((t) => (
                        <span key={t} className="inline-flex px-1.5 py-0.5 rounded text-xs font-mono text-muted bg-white/4 border border-white/8">{t}</span>
                      ))}
                      {proj.technologies.length > 4 && (
                        <span className="text-xs font-mono text-subtle">+{proj.technologies.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                  {isDeleting ? (
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-xs font-mono text-muted flex-1">Delete?</span>
                      <button onClick={() => handleDelete(proj._id)}
                        className="text-xs font-mono text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-400/10 transition-colors">
                        Yes
                      </button>
                      <button onClick={() => setDeletingId(null)}
                        className="text-xs font-mono text-muted hover:text-white px-2 py-1 rounded hover:bg-white/8 transition-colors">
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-1">
                        <button onClick={() => setEditorProj(proj)} title="Edit"
                          className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                          <EditIcon />
                        </button>
                        <button onClick={() => handleToggleFeature(proj._id, proj.featured)}
                          title={proj.featured ? 'Unfeature' : 'Feature'}
                          className={`p-1.5 rounded-md transition-colors ${proj.featured ? 'text-yellow-400 hover:text-muted hover:bg-white/5' : 'text-muted hover:text-yellow-400 hover:bg-yellow-400/10'}`}>
                          <StarIcon />
                        </button>
                        <button onClick={() => setDeletingId(proj._id)} title="Delete"
                          className="p-1.5 rounded-md text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                          <TrashIcon />
                        </button>
                      </div>
                      <button
                        onClick={() => handleTogglePublished(proj._id, proj.published)}
                        className={`text-xs font-mono px-2.5 py-1 rounded-md border transition-colors duration-200 ${
                          proj.published
                            ? 'text-emerald border-emerald/20 hover:bg-emerald/8'
                            : 'text-muted border-white/8 hover:text-white hover:border-white/20'
                        }`}>
                        {proj.published ? 'Published' : 'Draft'}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {editorProj !== undefined && (
          <ProjectFormModal
            key={editorProj?._id ?? 'new'}
            project={editorProj}
            onClose={() => setEditorProj(undefined)}
            onSaved={fetchProjects}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default AdminProjects
