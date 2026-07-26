import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-[#5c5c72] mb-4">404 — Page Not Found</p>
        <Link
          href="/"
          className="text-xs text-[#5c5c72] hover:text-[#06b6d4] transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
