import React from 'react'
import { geist, geistMono } from '@/lib/fonts'
import { APP_NAME, APP_TAGLINE } from '@/lib/brand'
import './globals.css'

export const metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    'Agenda, historia clínica, recetas, caja y recordatorios por WhatsApp para médicos y clínicas en República Dominicana.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
