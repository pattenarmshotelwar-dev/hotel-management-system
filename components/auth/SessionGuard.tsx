'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// 15 minutes of inactivity timeout
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000
const SESSION_ACTIVE_KEY = 'patten_hotel_session_active'
const LAST_ACTIVITY_KEY = 'patten_hotel_last_activity'

export default function SessionGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const lastActiveRef = useRef<number>(Date.now())
  const isLoggingOutRef = useRef<boolean>(false)

  const isPublicPage = pathname === '/login' || pathname.startsWith('/api/')

  const handleLogout = useCallback(async (reason: 'inactivity' | 'tab_closed') => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true

    sessionStorage.removeItem(SESSION_ACTIVE_KEY)
    sessionStorage.removeItem(LAST_ACTIVITY_KEY)

    await supabase.auth.signOut()

    if (reason === 'inactivity') {
      toast.error('Session expired due to inactivity. Please log in again.')
    }

    router.push('/login')
    router.refresh()
  }, [supabase, router])

  const updateActivity = useCallback(() => {
    const now = Date.now()
    // Throttle timestamp writes
    if (now - lastActiveRef.current > 2000) {
      lastActiveRef.current = now
      sessionStorage.setItem(LAST_ACTIVITY_KEY, now.toString())
    }
  }, [])

  useEffect(() => {
    if (isPublicPage) {
      isLoggingOutRef.current = false
      return
    }

    // Check if user is authenticated
    const checkSessionState = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Verify tab-level session persistence
      // sessionStorage is isolated per tab and cleared on tab/window close
      const isTabActive = sessionStorage.getItem(SESSION_ACTIVE_KEY)
      if (!isTabActive) {
        // Tab was closed and reopened, or brand new tab without login in this tab
        await handleLogout('tab_closed')
        return
      }

      // Check last activity timestamp
      const storedLastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY)
      if (storedLastActivity) {
        const elapsed = Date.now() - parseInt(storedLastActivity, 10)
        if (elapsed > INACTIVITY_TIMEOUT_MS) {
          await handleLogout('inactivity')
          return
        }
      }

      // Mark tab as active and record current activity
      sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true')
      sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
      lastActiveRef.current = Date.now()
    }

    checkSessionState()

    // Activity event listeners
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }))

    // Periodic inactivity checker
    const interval = setInterval(() => {
      const storedLastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY)
      const lastActive = storedLastActivity ? parseInt(storedLastActivity, 10) : lastActiveRef.current
      if (Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
        handleLogout('inactivity')
      }
    }, 10000)

    // Visibility change checker (when returning to tab after being away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const storedLastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY)
        const lastActive = storedLastActivity ? parseInt(storedLastActivity, 10) : lastActiveRef.current
        if (Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
          handleLogout('inactivity')
        } else {
          updateActivity()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      events.forEach(evt => window.removeEventListener(evt, updateActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [isPublicPage, handleLogout, updateActivity, supabase.auth])

  return null
}
