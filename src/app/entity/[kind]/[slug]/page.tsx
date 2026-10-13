import EntityProfile from '@/components/EntityProfile'

// 实体档案路由薄壳：只校验 kind，其余交给客户端档案组件（它负责拉数据与交互）。
// kind 非法时不渲染档案，直接给空状态并引导回工作台，避免拼错 URL 时白屏。
const KINDS = ['vendor', 'model'] as const

export default function EntityPage({ params }: { params: { kind: string; slug: string } }) {
  const valid = (KINDS as readonly string[]).includes(params.kind)
  if (!valid) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-[13px] text-ink-2">未知的实体类型 / Unknown entity kind</p>
        <p className="text-[10px] text-muted font-mono">{params.kind}</p>
        <p className="text-[10px] text-muted">仅支持 vendor 或 model / Only &apos;vendor&apos; or &apos;model&apos; is supported</p>
        <a href="/nexus?tab=dashboard" className="text-[11px] px-3 py-1.5 rounded-md bg-accent-bg border border-accent text-accent hover:opacity-80 transition-opacity">
          返回工作台 / Back to workspace
        </a>
      </div>
    )
  }
  return <EntityProfile kind={params.kind as 'vendor' | 'model'} slug={params.slug} />
}
