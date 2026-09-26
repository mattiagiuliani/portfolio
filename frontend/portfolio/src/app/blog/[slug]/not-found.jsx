import Link from 'next/link'

export default function PostNotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 text-center px-6">
      <p className="text-5xl">*</p>
      <h1 className="text-2xl font-bold text-white">Article not found</h1>
      <p className="text-muted text-sm font-mono">This post does not exist or has been removed.</p>
      <Link href="/blog" className="text-primary font-mono text-sm hover:underline">Back to Blog</Link>
    </main>
  )
}