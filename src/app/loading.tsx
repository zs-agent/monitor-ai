export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-[#06b6d4]/30 border-t-[#06b6d4] rounded-full animate-spin" />
        <p className="text-sm text-[#5c5c72]">Loading...</p>
      </div>
    </div>
  )
}
