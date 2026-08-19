import { Card } from '@/components/ui/card'

export function JobTracker({ events }: { events: Array<{ label: string; at: string; done: boolean }> }) {
  return (
    <Card className="p-0">
      <div className="divide-y divide-slate-100">
        {events.map((event, index) => (
          <div key={`${event.label}-${index}`} className="flex gap-4 p-4">
            <div className={event.done ? 'mt-1 size-4 rounded-full bg-emerald-500 ring-4 ring-emerald-100' : 'mt-1 size-4 rounded-full bg-slate-300 ring-4 ring-slate-100'} />
            <div className="flex-1">
              <p className="font-bold text-slate-950">{event.label}</p>
              <p className="text-sm text-slate-500">{event.at}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
