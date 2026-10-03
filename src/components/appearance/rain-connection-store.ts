'use client'

import { create } from 'zustand'
import type { ConnectionState } from '@/app/login/components/connectionSequence'

export interface RainConnection extends ConnectionState {
  id: number
  destination: string
  onDismiss: () => void
}

interface RainConnectionStore {
  connection: RainConnection | null
  begin: (connection: Omit<RainConnection, 'id'>) => number
  update: (id: number, state: ConnectionState) => void
  clear: (id: number) => void
}

let nextId = 0

// This transient state lives above /login; it contains no credentials and is
// never persisted. Matching ids prevent a late response reviving a dismissed trip.
export const useRainConnection = create<RainConnectionStore>((set) => ({
  connection: null,
  begin: (connection) => {
    const id = ++nextId
    set({ connection: { ...connection, id } })
    return id
  },
  update: (id, state) => set(({ connection }) => ({
    connection: connection?.id === id ? { ...connection, ...state } : connection,
  })),
  clear: (id) => set(({ connection }) => ({
    connection: connection?.id === id ? null : connection,
  })),
}))
