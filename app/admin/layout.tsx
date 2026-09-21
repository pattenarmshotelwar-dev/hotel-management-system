'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  CreditCard,
  Settings,
  Wrench,
  Users,
  Briefcase,
  TrendingUp,
  Archive,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/calendar', label: 'Calendar', icon: Calendar },
  { href: '/admin/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/admin/pricing', label: 'Pricing & Yield', icon: TrendingUp },
  { href: '/admin/guests', label: 'Guest CRM', icon: Users },
  { href: '/admin/luggage', label: 'Luggage Tracker', icon: Briefcase },
  { href: '/admin/lost-and-found', label: 'Lost & Found', icon: Archive },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/housekeeping', label: 'Housekeeping', icon: Wrench },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    try {
      localStorage.removeItem('patten_hotel_last_activity')
      sessionStorage.removeItem('patten_hotel_last_activity')
      sessionStorage.removeItem('patten_hotel_session_active')
    } catch (e) {
      // ignore
    }
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 transform transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 flex flex-col shrink-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700">
          <Image
            src="/logo.jpg"
            alt="The Patten Arms Hotel"
            width={140}
            height={60}
            className="h-10 w-auto object-contain"
            priority
            unoptimized
          />
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Logout in Sidebar */}
        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-red-400 w-full transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with Permanent Sign Out */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center gap-3 sm:gap-4 sticky top-0 z-20 shadow-xs">
          <button
            className="lg:hidden text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-slate-800 font-semibold text-base sm:text-lg">
              {navItems.find(n => pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href)))?.label ?? 'Dashboard'}
            </h2>
          </div>
          <div className="text-xs text-slate-400 hidden sm:block">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          {/* Top Bar Sign Out Button (Visible on all devices and window sizes) */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:text-red-600 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors cursor-pointer shadow-xs"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Sign Out</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
