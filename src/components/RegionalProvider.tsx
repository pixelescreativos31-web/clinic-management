'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_REGIONAL, type Regional } from '@/lib/regional'

const RegionalContext = createContext<Regional>(DEFAULT_REGIONAL)

/** The clinic's regional preferences for client components (set once in the dashboard layout). */
export function RegionalProvider({ value, children }: { value: Regional; children: React.ReactNode }) {
  return <RegionalContext.Provider value={value}>{children}</RegionalContext.Provider>
}

export const useRegional = () => useContext(RegionalContext)
