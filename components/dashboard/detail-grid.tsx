import { Card } from '@/components/ui/card'

export type DetailItem = {
  label: string
  value: string
  helper?: string
}

export function DetailGrid({ items }: { items: DetailItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{item.label}</p>
          <p className="mt-2 font-black text-slate-950">{item.value}</p>
          {item.helper ? <p className="mt-1 text-sm text-slate-600">{item.helper}</p> : null}
        </Card>
      ))}
    </div>
  )
}
