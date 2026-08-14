import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-muted mb-4">404 — Page Not Found</p>
        <Link
          href="/"
          className="text-xs text-muted hover:text-accent transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
