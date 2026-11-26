// src/lib/fonts.ts — medira typography (design handoff 2026-11, "Clinical Calm")
//
// Geist for everything, Geist Mono for folios, codes and shortcuts. Wired up in
// src/app/(frontend)/layout.tsx; globals.css maps --font-geist / --font-geist-mono
// to --font-sans / --font-display / --font-mono.

import { Geist, Geist_Mono } from 'next/font/google'

export const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-geist',
  display: 'swap',
})

export const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-geist-mono',
  display: 'swap',
})
