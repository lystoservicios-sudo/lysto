'use client'

import { FileImage, FileVideo, ImagePlus, Trash2, TriangleAlert } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useId, useState, type ChangeEvent } from 'react'

import { cn } from '@/lib/utils/cn'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])

function fileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MediaFilePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isVideo = file.type.startsWith('video/')

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (previewUrl && !isVideo) {
    return <Image src={previewUrl} alt={`Vista previa de ${file.name}`} width={56} height={56} unoptimized className="h-14 w-14 rounded-xl object-cover" />
  }

  if (previewUrl && isVideo) {
    return <video src={previewUrl} aria-label={`Vista previa de ${file.name}`} muted className="h-14 w-14 rounded-xl bg-slate-950 object-cover" />
  }

  const Icon = isVideo ? FileVideo : FileImage
  return <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon aria-hidden="true" className="h-5 w-5" /></div>
}

export function MediaUploader({ files, onFilesChange, maxFiles = 5, maxSizeMb = 15 }: {
  files: readonly File[]
  onFilesChange: (files: File[]) => void
  maxFiles?: number
  maxSizeMb?: number
}) {
  const inputId = useId()
  const [error, setError] = useState<string | null>(null)

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
    const availableSlots = Math.max(0, maxFiles - files.length)
    const invalidType = selected.find((file) => !allowedTypes.has(file.type))
    const oversized = selected.find((file) => file.size > maxSizeMb * 1024 * 1024)

    if (invalidType) {
      setError(`“${invalidType.name}” no tiene un formato admitido.`)
      event.target.value = ''
      return
    }

    if (oversized) {
      setError(`“${oversized.name}” supera el máximo de ${maxSizeMb} MB.`)
      event.target.value = ''
      return
    }

    if (selected.length > availableSlots) {
      setError(`Podés seleccionar hasta ${maxFiles} archivos.`)
      event.target.value = ''
      return
    }

    setError(null)
    onFilesChange([...files, ...selected])
    event.target.value = ''
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id={`${inputId}-title`} className="font-black text-slate-950">Fotos o video</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Opcional. Ayuda a preparar la visita; todavía no se sube a ningún servidor.</p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-500">{files.length} de {maxFiles}</span>
      </div>

      <label
        htmlFor={inputId}
        className={cn(
          'flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition-colors',
          'hover:border-blue-400 hover:bg-blue-50 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100',
          files.length >= maxFiles && 'cursor-not-allowed opacity-60'
        )}
      >
        <ImagePlus aria-hidden="true" className="h-6 w-6 text-blue-700" />
        <span className="mt-2 text-sm font-bold text-slate-950">Agregar fotos o video</span>
        <span className="mt-1 text-xs text-slate-500">JPG, PNG, WebP, MP4 o WebM · máximo {maxSizeMb} MB</span>
        <input
          id={inputId}
          type="file"
          aria-label="Agregar fotos o video"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          disabled={files.length >= maxFiles}
          onChange={handleFiles}
          className="sr-only"
        />
      </label>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {files.length ? (
        <ul aria-label="Archivos seleccionados" className="grid gap-2 sm:grid-cols-2">
          {files.map((file, index) => {
            return (
              <li key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                <MediaFilePreview file={file} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-950">{file.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500"><span>Seleccionado en este dispositivo</span> · {fileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Quitar ${file.name}`}
                  onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
