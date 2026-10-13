'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type ClientFlowContextValue = {
  focused: boolean
  register: () => () => void
}

const ClientFlowContext = createContext<ClientFlowContextValue | null>(null)

export function ClientFlowProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  const register = useCallback(() => {
    setCount((current) => current + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      setCount((current) => Math.max(0, current - 1))
    }
  }, [])
  const value = useMemo(() => ({ focused: count > 0, register }), [count, register])
  return <ClientFlowContext.Provider value={value}>{children}</ClientFlowContext.Provider>
}

export function useClientNavigationFocused() {
  return useContext(ClientFlowContext)?.focused ?? false
}

/** Legacy embeds without the customer shell do not need navigation registration. */
export function useClientFocusedFlow(active: boolean) {
  const register = useContext(ClientFlowContext)?.register
  useEffect(() => {
    if (active && register) return register()
  }, [active, register])
}
