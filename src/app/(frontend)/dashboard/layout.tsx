import React from 'react'
import { requireDashboardSession } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/brand'
import { isIndividualPractice, isPractitioner } from '@/lib/practice'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = await requireDashboardSession()

  // Existing sessions of a suspended clinic see a stop screen (spec §8.5).
  if (tenant?.status === 'suspended') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
        <div className="font-display text-xl font-semibold text-primary">{APP_NAME}</div>
        <h1 className="text-lg font-semibold">La cuenta de este consultorio está suspendida</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Escriba a {SUPPORT_EMAIL} para reactivar su consultorio.
        </p>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        clinicName={tenant?.name ?? 'Consultorio'}
        userName={user.name}
        role={user.role}
        practitioner={isPractitioner(user)}
        individual={isIndividualPractice(tenant)}
      />
      <main className="flex-1 overflow-x-hidden px-4 pt-6 pb-24 sm:px-6 md:pb-8">
        <div className="mx-auto max-w-7xl animate-fade-up">{children}</div>
      </main>
    </div>
  )
}
