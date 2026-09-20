'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// 15 minutes of inactivity timeout
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000
const LAST_ACTIVITY_KEY = 'patten_hotel_last_activity'

export default function SessionGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const isLoggingOutRef = useRef<boolean>(false)

  const isPublicPage = pathname === '/login' || pathname.startsWith('/api/')

  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true

    try {
      localStorage.removeItem(LAST_ACTIVITY_KEY)
      sessionStorage.removeItem(LAST_ACTIVITY_KEY)
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    }

    toast.error('Session expired due to 15 minutes of inactivity. Please log in again.')
    router.push('/login')
    router.refresh()
  }, [supabase, router])

  const updateActivity = useCallback(() => {
    if (isLoggingOutRef.current) return
    const now = Date.now()
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString())
    } catch (e) {
      // Ignore storage errors
    }
  }, [])

  useEffect(() => {
    if (isPublicPage) {
      isLoggingOutRef.current = false
      return
    }

    // Initialize or check activity on route mount
    try {
      const stored = localStorage.getItem(LAST_ACTIVITY_KEY)
      const now = Date.now()
      if (stored) {
        const elapsed = now - parseInt(stored, 10)
        if (elapsed > INACTIVITY_TIMEOUT_MS) {
          handleLogout()
          return
        }
      }
      // Record current activity timestamp
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString())
    } catch (e) {
      // Ignore storage errors
    }

    // Activity event listeners (throttled to every 3 seconds to avoid DOM overhead)
    let lastThrottled = 0
    const onUserActivity = () => {
      const now = Date.now()
      if (now - lastThrottled > 3000) {
        lastThrottled = now
        updateActivity()
      }
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(evt => window.addEventListener(evt, onUserActivity, { passive: true }))

    // Periodic inactivity checker every 15 seconds
    const interval = setInterval(() => {
      if (isLoggingOutRef.current) return
      try {
        const stored = localStorage.getItem(LAST_ACTIVITY_KEY)
        if (stored) {
          const elapsed = Date.now() - parseInt(stored, 10)
          if (elapsed > INACTIVITY_TIMEOUT_MS) {
            handleLogout()
          }
        }
      } catch (e) {
        // Ignore storage errors
      }
    }, 15000)

    // Visibility change checker (when returning to tab after being away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoggingOutRef.current) {
        try {
          const stored = localStorage.getItem(LAST_ACTIVITY_KEY)
          if (stored) {
            const elapsed = Date.now() - parseInt(stored, 10)
            if (elapsed > INACTIVITY_TIMEOUT_MS) {
              handleLogout()
            } else {
              updateActivity()
            }
          }
        } catch (e) {
          // Ignore storage errors
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      events.forEach(evt => window.removeEventListener(evt, onUserActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [isPublicPage, handleLogout, updateActivity])

  return null
}
