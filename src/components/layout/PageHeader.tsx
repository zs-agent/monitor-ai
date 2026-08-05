'use client'

interface Props {
  title: string
  valueProp: string
  actions?: React.ReactNode
}

export default function PageHeader({ title, valueProp, actions }: Props) {
  return (
    <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-[#1e1e2e] mb-4">
      <div>
        <h1 className="text-base font-bold text-[#e5e5e5]">{title}</h1>
        <p className="text-[10px] text-[#5c5c72] mt-0.5 max-w-lg">{valueProp}</p>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
