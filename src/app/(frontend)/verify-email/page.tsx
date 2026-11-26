// Landing page for the emailed confirmation link (BACKLOG §1.1). Server-rendered:
// the token is consumed during the render, so a valid link shows success straight
// away and a dead one offers a resend.

import Link from 'next/link'
import { getPayloadClient } from '@/lib/auth'
import { verifyEmailToken } from '@/lib/verification'
import { AuthShell, AuthTitle, authBtn, authLink } from '../login/AuthShell'
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
    <AuthShell>
      {verified ? (
        <>
          <AuthTitle
            title="Correo verificado"
            sub="Su consultorio ya está en espera de aprobación. Le escribiremos en cuanto sea aprobado y entonces podrá entrar."
          />
          <Link href="/login" className={`${authBtn} mt-5`}>
            Ir a entrar
          </Link>
        </>
      ) : (
        <>
          <AuthTitle
            title="Este enlace no funcionó"
            sub="El enlace de verificación no es válido, venció o ya fue usado. Si su correo ya está verificado, simplemente entre; si no, solicite un nuevo enlace."
          />
          <ResendForm />
          <p className="mt-4 text-sm text-muted-foreground">
            ¿Ya lo verificó?{' '}
            <Link href="/login" className={authLink}>
              Entrar
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
