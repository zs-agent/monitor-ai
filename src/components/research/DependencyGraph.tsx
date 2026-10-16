'use client'

interface Node { id: string; label: string }
interface Edge { source: string; target: string }

/** SVG draws the persisted edges, rather than generating an illustrative graph. */
export default function DependencyGraph({ question, claims, evidence, edges, onEvidence }: {
  question: Node; claims: Node[]; evidence: Node[]; edges: Edge[]; onEvidence: (id: string) => void
}) {
  const height = Math.max(180, Math.max(claims.length, evidence.length) * 65 + 60)
  const positions = new Map<string, { x: number; y: number; node: Node; kind: string }>()
  positions.set(question.id, { x: 12, y: height / 2 - 20, node: question, kind: 'Q' })
  claims.forEach((node, i) => positions.set(node.id, { x: 264, y: 50 + i * 65, node, kind: 'C' }))
  evidence.forEach((node, i) => positions.set(node.id, { x: 516, y: 50 + i * 65, node, kind: 'E' }))
  return <div className="overflow-x-auto rounded border border-edge bg-elevated">
    <svg role="group" aria-label="问题结论资料依赖图" viewBox={`0 0 750 ${height}`} className="min-w-[620px] w-full" style={{ minHeight: height }}>
      <defs><marker id="dependency-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="currentColor" /></marker></defs>
      {['分析问题 Q', '关键结论 C', '来源资料 E'].map((label, i) => <text key={label} x={12 + i * 252} y={23} fill="currentColor" fontSize={12}>{label}</text>)}
      {edges.map((edge, i) => { const a = positions.get(edge.source), b = positions.get(edge.target); if (!a || !b) return null; return <path key={i} d={`M${a.x + 215},${a.y + 20} C${a.x + 245},${a.y + 20} ${b.x - 28},${b.y + 20} ${b.x},${b.y + 20}`} fill="none" stroke="currentColor" opacity={.35} markerEnd="url(#dependency-arrow)" /> })}
      {Array.from(positions.values()).map(({ x, y, node, kind }) => <g key={node.id} role={kind === 'E' ? 'button' : undefined} aria-label={kind === 'E' ? `展开来源 ${node.label}` : undefined} tabIndex={kind === 'E' ? 0 : undefined} onClick={() => { if (kind === 'E') onEvidence(node.id) }} onKeyDown={e => { if (kind === 'E' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onEvidence(node.id) } }} className={kind === 'E' ? 'cursor-pointer text-accent' : 'text-ink-2'}>
        <title>{node.label}</title><rect x={x} y={y} width={215} height={40} rx={6} stroke="currentColor" fill="var(--bg-elevated, #151922)" /><text x={x + 8} y={y + 24} fontSize={11} fill="currentColor">{node.label.slice(0, 16)}{node.label.length > 16 ? '…' : ''}</text>
      </g>)}
    </svg>
  </div>
}
