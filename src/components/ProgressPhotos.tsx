'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, Spinner } from './primitives'
import { deleteProgressPhoto, uploadProgressPhoto } from '@/app/(frontend)/dashboard/programs/actions'
import { PHOTO_VIEWS, weekLabel } from '@/lib/program'

export type PhotoItem = { id: string; url: string; week: number; view: string; takenAt: string }

const INPUT = 'w-full rounded-[10px] border border-[#e3e7e7] bg-[#fafbfb] px-3 h-[42px] text-sm outline-none focus:border-[#0d6e60]'
const MAX_SIDE = 1600

/** Resize in the browser (max 1600 px, JPEG) so uploads stay small and EXIF-free. */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la foto.'))), 'image/jpeg', 0.85))
}

const fmt = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export function ProgressPhotos({
  programId,
  photos,
  weeks,
  today,
  canUpload,
}: {
  programId: string
  photos: PhotoItem[]
  /** Weeks with a recorded control (photos attach to one of them). */
  weeks: number[]
  today: string
  canUpload: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [week, setWeek] = useState(String(weeks.length ? weeks[weeks.length - 1] : 0))
  const [view, setView] = useState<string>('front')
  const [date, setDate] = useState(today)
  const [file, setFile] = useState<File | null>(null)
  const [inputKey, setInputKey] = useState(0)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const upload = () => {
    if (!file) return setError('Elija una foto.')
    setError(null)
    start(async () => {
      try {
        const blob = await shrink(file)
        const fd = new FormData()
        fd.set('file', new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
        fd.set('program', programId)
        fd.set('week', week)
        fd.set('view', view)
        fd.set('takenAt', date)
        const res = await uploadProgressPhoto(fd)
        if (!res.ok) return setError(res.message)
        setFile(null)
        setInputKey((k) => k + 1)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo subir la foto.')
      }
    })
  }

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteProgressPhoto(id)
      if (!res.ok) setError(res.message)
      setConfirmDel(null)
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-4">
      {/* Initial vs latest, per view */}
      <div className="grid gap-3 sm:grid-cols-2">
        {PHOTO_VIEWS.map((v) => {
          const list = photos.filter((p) => p.view === v.value).sort((a, b) => a.week - b.week || a.takenAt.localeCompare(b.takenAt))
          const first = list[0]
          const last = list.length > 1 ? list[list.length - 1] : null
          return (
            <div key={v.value} className="rounded-[12px] border border-[#e3e7e7] p-2.5">
              <p className="mb-2 text-xs font-semibold">{v.label}</p>
              {!first ? (
                <p className="py-6 text-center text-xs text-[#6b7577]">Sin fotos</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[first, last].map((p, i) =>
                    p ? (
                      <figure key={p.id} className="flex flex-col gap-1">
                        <a href={p.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={`${v.label} · ${weekLabel(p.week)}`} className="aspect-[3/4] w-full rounded-[8px] bg-[#f1f3f3] object-cover" loading="lazy" />
                        </a>
                        <figcaption className="text-[11px] text-[#6b7577]">
                          {i === 0 ? 'Inicial' : 'Más reciente'} · {weekLabel(p.week)} · {fmt(p.takenAt)}
                        </figcaption>
                      </figure>
                    ) : (
                      <div key="none" className="flex aspect-[3/4] items-center justify-center rounded-[8px] border border-dashed text-center text-[11px] text-[#6b7577]">
                        Suba una foto posterior para comparar
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Full gallery by week */}
      {photos.length > 0 && (
        <details className="rounded-[12px] border border-[#e3e7e7] p-3">
          <summary className="cursor-pointer text-sm font-semibold">Todas las fotos ({photos.length})</summary>
          <div className="mt-3 flex flex-col gap-3">
            {[...new Set(photos.map((p) => p.week))]
              .sort((a, b) => a - b)
              .map((w) => (
                <div key={w}>
                  <p className="mb-1.5 text-xs font-semibold text-[#6b7577]">{weekLabel(w)}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {photos
                      .filter((p) => p.week === w)
                      .map((p) => (
                        <figure key={p.id} className="flex flex-col gap-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={`${PHOTO_VIEWS.find((x) => x.value === p.view)?.label} · ${weekLabel(p.week)}`} className="aspect-[3/4] w-full rounded-[8px] bg-[#f1f3f3] object-cover" loading="lazy" />
                          <figcaption className="flex items-center justify-between gap-1 text-[11px] text-[#6b7577]">
                            <span>
                              {PHOTO_VIEWS.find((x) => x.value === p.view)?.label} · {fmt(p.takenAt)}
                            </span>
                            {canUpload &&
                              (confirmDel === p.id ? (
                                <span className="flex gap-1">
                                  <button type="button" disabled={pending} onClick={() => remove(p.id)} className="font-semibold text-red">
                                    Borrar
                                  </button>
                                  <button type="button" onClick={() => setConfirmDel(null)}>
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button type="button" onClick={() => setConfirmDel(p.id)} aria-label="Eliminar foto" className="hover:text-red">
                                  ✕
                                </button>
                              ))}
                          </figcaption>
                        </figure>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </details>
      )}

      {canUpload && (
        <div className="flex flex-col gap-2 rounded-[12px] bg-[#f4f6f6] p-3">
          <p className="text-sm font-semibold">Agregar foto</p>
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6b7577]">Semana</span>
              <select value={week} onChange={(e) => setWeek(e.target.value)} className={INPUT}>
                {(weeks.length ? weeks : [0]).map((w) => (
                  <option key={w} value={w}>
                    {weekLabel(w)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6b7577]">Vista</span>
              <select value={view} onChange={(e) => setView(e.target.value)} className={INPUT}>
                {PHOTO_VIEWS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6b7577]">Fecha</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[#6b7577]">Foto</span>
              <input key={inputKey} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
            </label>
          </div>
          <button type="button" onClick={upload} disabled={pending || !file} className={`${btnPrimary} w-fit`}>
            {pending && <Spinner />}
            Subir foto
          </button>
          {error && <p className="text-xs text-red" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
