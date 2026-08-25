'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from 'react'

const MOBILE_BREAKPOINT = 768
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

type AppShellContextValue = {
  desktopOpen: boolean
  mobileOpen: boolean
  isMobile: boolean
  setDesktopOpen: (open: boolean) => void
  setMobileOpen: (open: boolean) => void
  toggleSidebar: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

export function useAppShell() {
  const context = useContext(AppShellContext)

  if (!context) {
    throw new Error('useAppShell must be used within an AppShellProvider')
  }

  return context
}

export function AppShellProvider({
  children,
  defaultOpen = true
}: {
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [desktopOpen, setDesktopOpenState] = useState(defaultOpen)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const previousBodyOverflow = useRef<string | null>(null)

  const setDesktopOpen = useCallback((open: boolean) => {
    setDesktopOpenState(open)
    document.cookie = `sidebar_state=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`
  }, [])

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileOpen((open) => !open)
      return
    }

    setDesktopOpen(!desktopOpen)
  }, [desktopOpen, isMobile, setDesktopOpen])

  useEffect(() => {
    const updateViewport = () => {
      const nextIsMobile = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(nextIsMobile)
      if (!nextIsMobile) setMobileOpen(false)
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'b' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        toggleSidebar()
      }

      if (event.key === 'Escape' && mobileOpen) {
        setMobileOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen, toggleSidebar])

  useEffect(() => {
    if (!mobileOpen) return

    const shellContent = document.querySelector<HTMLElement>('[data-app-shell-content]')
    const shellContentWasInert = shellContent?.hasAttribute('inert') ?? false
    previousBodyOverflow.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    shellContent?.setAttribute('inert', '')

    return () => {
      document.body.style.overflow = previousBodyOverflow.current ?? ''
      previousBodyOverflow.current = null
      if (!shellContentWasInert) shellContent?.removeAttribute('inert')
    }
  }, [mobileOpen])

  const value = useMemo<AppShellContextValue>(() => ({
    desktopOpen,
    mobileOpen,
    isMobile,
    setDesktopOpen,
    setMobileOpen,
    toggleSidebar,
    triggerRef
  }), [desktopOpen, isMobile, mobileOpen, setDesktopOpen, toggleSidebar])

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}
