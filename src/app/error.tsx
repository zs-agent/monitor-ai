'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-muted mb-4">Something went wrong</p>
        <button
          onClick={() => reset()}
          className="text-xs text-muted hover:text-accent transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
