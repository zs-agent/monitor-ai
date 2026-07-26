'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-[#5c5c72] mb-4">Something went wrong</p>
        <button
          onClick={() => reset()}
          className="text-xs text-[#5c5c72] hover:text-[#06b6d4] transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
