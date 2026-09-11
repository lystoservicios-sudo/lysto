'use client'

import { FileImage, FileVideo, ImagePlus, Trash2, TriangleAlert } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { uploadPrivateFile, type UploadHandle, type UploadTarget, type VerifiedUpload } from '@/lib/uploads/client'

import { cn } from '@/lib/utils/cn'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
export type SavedPhoto = { file: File; upload: VerifiedUpload }

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

export function MediaUploader({ files, onFilesChange, maxFiles = 5, maxSizeMb = 10, target = { kind: 'request-photo' }, savedPhotos, onSavedPhotosChange, onBusyChange }: {
  files: readonly File[]
  onFilesChange: (files: File[]) => void
  maxFiles?: number
  maxSizeMb?: number
  target?: UploadTarget | null
  savedPhotos?: readonly SavedPhoto[]
  onSavedPhotosChange?: (photos: SavedPhoto[]) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const inputId = useId()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [localSaved, setLocalSaved] = useState<SavedPhoto[]>([])
  const saved = savedPhotos ?? localSaved
  const handles = useRef(new WeakMap<File, UploadHandle>())
  const draft = useRef<string | undefined>(target?.draftId)
  const effectiveMaxMb = Math.min(maxSizeMb, target?.kind === 'job-document' ? 20 : 10)
  const pendingFiles = files.filter(file => !saved.some(item => item.file === file))
  const persist = async () => {
    if (busy || !target) return
    setBusy(true); onBusyChange?.(true); setError(null)
    let completed = [...saved]
    try {
      draft.current ??= saved.find(item => item.upload.draftId)?.upload.draftId ?? undefined
      for (const file of pendingFiles) {
        const upload = await uploadPrivateFile(file, { ...target, ...(target.kind === 'request-photo' && !target.entityId ? { draftId: draft.current } : {}) }, handle => {
          if (!handle) { handles.current.delete(file); return }
          handles.current.set(file, handle)
          draft.current ??= handle.draftId ?? undefined
        }, handles.current.get(file))
        completed = [...completed, { file, upload }]
        setLocalSaved(completed); onSavedPhotosChange?.(completed)
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No pudimos guardar la foto. Intentá nuevamente.') }
    finally { setBusy(false); onBusyChange?.(false) }
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
    const availableSlots = Math.max(0, maxFiles - files.length)
    const invalidType = selected.find((file) => !allowedTypes.has(file.type))
    const oversized = selected.find((file) => file.size < 1 || file.size > effectiveMaxMb * 1024 * 1024)

    if (invalidType) {
      setError(`“${invalidType.name}” no tiene un formato admitido.`)
      event.target.value = ''
      return
    }

    if (oversized) {
      setError(`“${oversized.name}” está vacío o supera el máximo de ${effectiveMaxMb} MB.`)
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
          <h3 id={`${inputId}-title`} className="font-black text-slate-950">Fotos</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Seleccioná las fotos y guardalas para adjuntarlas de forma privada.</p>
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
        <span className="mt-2 text-sm font-bold text-slate-950">Agregar fotos</span>
        <span className="mt-1 text-xs text-slate-500">JPG, PNG o WebP · máximo {effectiveMaxMb} MB</span>
        <input
          id={inputId}
          type="file"
          aria-label="Agregar fotos"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || files.length >= maxFiles}
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
                  <p className="mt-0.5 text-xs text-slate-500"><span>{saved.some(item => item.file === file) ? (saved.find(item => item.file === file)?.upload.entityId ? 'Guardada y verificada' : 'Guardada en borrador privado') : 'Seleccionado en este dispositivo'}</span> · {fileSize(file.size)}</p>
                </div>
                {!saved.some(item => item.file === file) ? <button
                  type="button"
                  aria-label={`Quitar ${file.name}`}
                  disabled={busy}
                  onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {pendingFiles.length ? <button type="button" disabled={busy || !target} onClick={() => void persist()} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Guardando y verificando…' : 'Guardar fotos'}</button> : null}
      {!target ? <p className="text-sm text-slate-600">El trabajo debe estar guardado para adjuntar fotos.</p> : null}
    </section>
  )
}
