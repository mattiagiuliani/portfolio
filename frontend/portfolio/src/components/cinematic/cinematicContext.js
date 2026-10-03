'use client'

import { createContext, useContext } from 'react'

export const CinematicContext = createContext(null)

export function useCinematic() {
  const value = useContext(CinematicContext)
  if (!value) throw new Error('useCinematic must be used inside CinematicHome')
  return value
}
