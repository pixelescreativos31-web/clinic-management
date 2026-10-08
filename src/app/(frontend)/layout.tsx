import React from 'react'
import { dmSans, bricolage } from '@/lib/fonts'
import { APP_NAME, APP_TAGLINE } from '@/lib/brand'
import './globals.css'

export const metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    'Agenda de citas, historia clínica, recetas imprimibles, facturación y recordatorios por WhatsApp para médicos y clínicas. Desde US$25/mes por médico.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  )
}
