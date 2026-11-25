'use client'

// What a user who must use 2FA sees in the dashboard (spec §10):
// - during the clinic's grace period, a reminder strip above every page;
// - after it, only this enrollment screen until they enroll.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logoutAction } from '@/app/(frontend)/login/actions'
import { APP_NAME } from '@/lib/brand'
import { TwoFactorSetup } from './TwoFactorSetup'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function TwoFactorGraceStrip({ until, daysLeft }: { until: string; daysLeft: number }) {
  return (
    <div className="border-b border-[#f3e3c3] bg-[#faf3e6] px-4 py-2 text-[13px] text-[#78350f] md:px-5">
      <span className="font-medium">Active la verificación en dos pasos.</span>{' '}
      Será obligatoria desde el {fmtDate(until)} ({daysLeft === 1 ? 'queda 1 día' : `quedan ${daysLeft} días`}).{' '}
      <Link href="/dashboard/security" className="font-semibold text-[#78350f] underline underline-offset-2">
        Activar ahora
      </Link>
    </div>
  )
}

export function TwoFactorEnrollScreen({ email, reason }: { email: string; reason: string }) {
  const router = useRouter()
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#fafaf7] px-4 pt-[clamp(20px,5vw,56px)] pb-14 text-[#1c1917]">
      <div className="w-full max-w-[520px]">
        <div className="mb-5 text-center text-[22px] font-semibold tracking-[-0.04em]">{APP_NAME}</div>
        <div className="rounded-[14px] border border-[#e7e5e4] bg-white p-[clamp(20px,5vw,28px)]">
          <h1 className="text-[19px] font-semibold tracking-[-.02em]">Active la verificación en dos pasos</h1>
          <p className="mt-1 mb-4 text-sm text-[#57534e]">
            {reason} Protege los datos de sus pacientes aunque alguien conozca su contraseña.
          </p>
          <TwoFactorSetup email={email} onFinished={() => router.refresh()} />
        </div>
        <form action={logoutAction} className="mt-4 text-center">
          <button type="submit" className="text-sm font-medium text-[#57534e]">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  )
}
