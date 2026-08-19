import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ActionPanel({ title, description, primary, secondary, children }: { title: string; description: string; primary: string; secondary?: string; children?: ReactNode }) {
  return (
    <Card className="bg-slate-950 p-5 text-white">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="bg-white text-slate-950 hover:bg-slate-100">{primary}</Button>
        {secondary ? <Button type="button" variant="ghost" className="text-white hover:bg-white/10">{secondary}</Button> : null}
      </div>
    </Card>
  )
}
