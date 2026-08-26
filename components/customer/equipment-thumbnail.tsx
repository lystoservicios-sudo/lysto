import { AirVent, ImageOff } from 'lucide-react'
import Image from 'next/image'

import { cn } from '@/lib/utils/cn'

export function EquipmentThumbnail({ imageUrl, imageAlt, equipmentName, size = 'md', className }: {
  imageUrl?: string
  imageAlt?: string
  equipmentName: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = { sm: 'h-14 w-16', md: 'h-24 w-full', lg: 'h-48 w-full' }

  if (imageUrl) {
    return (
      <div className={cn('relative overflow-hidden rounded-2xl bg-slate-50', sizes[size], className)}>
        <Image src={imageUrl} alt={imageAlt ?? equipmentName} fill sizes={size === 'lg' ? '(max-width: 768px) 100vw, 480px' : '240px'} className="object-contain p-3" />
      </div>
    )
  }

  return (
    <div role="img" aria-label={`Sin imagen de ${equipmentName}`} className={cn('grid place-items-center rounded-2xl bg-slate-100 text-slate-500', sizes[size], className)}>
      <span className="flex flex-col items-center gap-1.5 text-xs font-semibold">
        {size === 'sm' ? <AirVent aria-hidden="true" className="h-5 w-5" /> : <ImageOff aria-hidden="true" className="h-6 w-6" />}
        {size !== 'sm' ? 'Sin imagen' : null}
      </span>
    </div>
  )
}
