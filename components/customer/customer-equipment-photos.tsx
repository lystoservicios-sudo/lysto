'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MediaUploader, type SavedPhoto } from './media-uploader'
import { FormFeedback } from './states'
import { assetRequest, assetError } from '@/lib/customer-assets/client'

type PhotoPage = { items: Array<{ id: string; createdAt: string }>; nextCursor: string | null }
export function CustomerEquipmentPhotos({
  equipmentId,
  archived = false
}: {
  equipmentId: string
  archived?: boolean
}) {
  const [files, setFiles] = useState<File[]>([])
  const [saved, setSaved] = useState<SavedPhoto[]>([])
  const [page, setPage] = useState<PhotoPage>({ items: [], nextCursor: null })
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function reload(more = false) {
    setBusy(true)
    setError('')
    setPreview(null)
    try {
      const result = await assetRequest<PhotoPage>(
        `/api/customer/equipment/photos?equipmentId=${equipmentId}${more && page.nextCursor ? `&cursor=${encodeURIComponent(page.nextCursor)}` : ''}`
      )
      setPage(
        more
          ? {
              ...result,
              items: [
                ...page.items,
                ...result.items.filter((item) => !page.items.some((old) => old.id === item.id))
              ]
            }
          : result
      )
    } catch (failure) {
      setError(assetError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function view(id: string) {
    setBusy(true)
    setError('')
    setPreview(null)
    try {
      setPreview(
        (await assetRequest<{ url: string }>('/api/uploads/read', 'POST', { intentId: id })).url
      )
    } catch (failure) {
      setError(assetError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-4" aria-label="Fotos del equipo">
      <h3 className="font-bold">Fotos del equipo</h3>
      {!archived ? (
        <MediaUploader
          files={files}
          onFilesChange={setFiles}
          savedPhotos={saved}
          onSavedPhotosChange={setSaved}
          onBusyChange={setBusy}
          target={{ kind: 'equipment-photo', entityId: equipmentId }}
        />
      ) : (
        <p>El equipo está archivado. Sus fotos guardadas siguen disponibles.</p>
      )}
      <FormFeedback state="error" message={error} />
      <Button type="button" variant="secondary" disabled={busy} onClick={() => reload()}>
        Consultar fotos guardadas
      </Button>
      <ul className="space-y-2">
        {page.items.map((photo, index) => (
          <li key={photo.id}>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => view(photo.id)}>
              Ver foto {index + 1}
            </Button>
          </li>
        ))}
      </ul>
      {page.nextCursor ? (
        <Button type="button" variant="secondary" disabled={busy} onClick={() => reload(true)}>
          Ver más fotos
        </Button>
      ) : null}
      {preview ? (
        <Image
          src={preview}
          unoptimized
          width={640}
          height={480}
          alt="Foto guardada del equipo"
          className="max-h-96 w-auto rounded-xl object-contain"
          onError={() => {
            setPreview(null)
            setError('La vista de la foto venció o no está disponible. Volvé a abrirla.')
          }}
        />
      ) : null}
    </section>
  )
}
