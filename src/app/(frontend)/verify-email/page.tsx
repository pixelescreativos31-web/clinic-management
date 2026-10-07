// Landing page for the emailed confirmation link (BACKLOG §1.1). Server-rendered:
// the token is consumed during the render, so a valid link shows success straight
// away and a dead one offers a resend.

import Link from 'next/link'
import { getPayloadClient } from '@/lib/auth'
import { verifyEmailToken } from '@/lib/verification'
import { btnPrimary } from '@/components/primitives'
import { IconCheck } from '@/components/icons'
import { APP_NAME } from '@/lib/brand'
import { ResendForm } from './ResendForm'

export const dynamic = 'force-dynamic'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  let verified = false
  if (token) {
    try {
      await verifyEmailToken(await getPayloadClient(), token)
      verified = true
    } catch {
      verified = false
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <Link href="/" className="mb-8 flex w-fit items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-primary">{APP_NAME}</span>
        </Link>

        {verified ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
              <IconCheck size={16} className="text-primary" />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">Correo verificado</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Su consultorio ya está en espera de aprobación. Le escribiremos en cuanto sea aprobado y
              entonces podrá iniciar sesión.
            </p>
            <Link href="/login" className={`${btnPrimary} mt-5 w-full`}>
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Este enlace no funcionó
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              El enlace de verificación no es válido, venció o ya fue usado. Si su correo ya está
              verificado, simplemente inicie sesión; si no, solicite un nuevo enlace.
            </p>
            <ResendForm />
            <p className="mt-4 text-sm text-muted-foreground">
              ¿Ya lo verificó?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
