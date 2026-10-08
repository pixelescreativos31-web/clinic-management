// src/lib/fonts.ts — EMR typography (design handoff 2026-10)
//
// DM Sans for text, Bricolage Grotesque for headings and figures. Wired up in
// src/app/(frontend)/layout.tsx; globals.css maps --font-dm-sans /
// --font-bricolage to --font-sans / --font-display.

import { Bricolage_Grotesque, DM_Sans } from 'next/font/google'

export const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-bricolage',
  display: 'swap',
})
