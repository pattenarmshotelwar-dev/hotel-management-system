'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Shield, User, Hotel, CalendarCheck, Sparkles, Receipt, Code2 } from 'lucide-react'
import Image from 'next/image'

type DepartmentRole = 'manager' | 'foh' | 'bookings' | 'housekeeping' | 'accounts' | 'developer'

interface RoleConfig {
  id: DepartmentRole
  label: string
  email: string
  destination: string
  icon: any
  tag: string
}

const ROLES: RoleConfig[] = [
  { id: 'manager', label: 'Manager', email: 'manager@pattenarms.co.uk', destination: '/admin', icon: Shield, tag: 'Admin' },
  { id: 'foh', label: 'Front of House', email: 'info@pattenarms.co.uk', destination: '/frontdesk', icon: Hotel, tag: 'Reception' },
  { id: 'bookings', label: 'Bookings', email: 'bookings@pattenarms.co.uk', destination: '/admin/bookings', icon: CalendarCheck, tag: 'Reservations' },
  { id: 'housekeeping', label: 'Housekeeping', email: 'housekeeping@pattenarms.co.uk', destination: '/housekeeping', icon: Sparkles, tag: 'Cleaning' },
  { id: 'accounts', label: 'Accounts', email: 'accounts@pattenarms.co.uk', destination: '/admin/payments', icon: Receipt, tag: 'Finance' },
  { id: 'developer', label: 'Developer', email: 'dev@uvdigital.co.uk', destination: '/admin', icon: Code2, tag: 'Full Access' },
]

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [selectedRole, setSelectedRole] = useState<DepartmentRole>('manager')
  const [email, setEmail] = useState('manager@pattenarms.co.uk')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRoleSelect = (role: RoleConfig) => {
    setSelectedRole(role.id)
    setEmail(role.email)
    setPassword('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const rawInput = email.trim().toLowerCase()
    let loginEmail = rawInput

    // Map common aliases/shortcuts to official emails
    const aliasMap: Record<string, string> = {
      'manager': 'manager@pattenarms.co.uk',
      'admin': 'manager@pattenarms.co.uk',
      'habib': 'manager@pattenarms.co.uk',
      'info': 'info@pattenarms.co.uk',
      'foh': 'info@pattenarms.co.uk',
      'reception': 'info@pattenarms.co.uk',
      'bookings': 'bookings@pattenarms.co.uk',
      'booking': 'bookings@pattenarms.co.uk',
      'housekeeping': 'housekeeping@pattenarms.co.uk',
      'clean': 'housekeeping@pattenarms.co.uk',
      'cleaning': 'housekeeping@pattenarms.co.uk',
      'accounts': 'accounts@pattenarms.co.uk',
      'finance': 'accounts@pattenarms.co.uk',
      'dev': 'dev@uvdigital.co.uk',
      'developer': 'dev@uvdigital.co.uk',
    }

    if (aliasMap[rawInput]) {
      loginEmail = aliasMap[rawInput]
    }

    let { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })

    // Fallbacks if user entered an alternative alias
    if (error) {
      const fallbacks: Record<string, string[]> = {
        'dev@uvdigital.co.uk': ['developer@pattenarms.co.uk', 'dev@pattenarms.co.uk'],
        'manager@pattenarms.co.uk': ['habib@pattenarms.com', 'pattenarmshotelwar@gmail.com'],
        'info@pattenarms.co.uk': ['foh@pattenarms.com', 'frontdesk@patternarmswarhotel.co.uk'],
        'housekeeping@pattenarms.co.uk': ['housekeeping@pattenarms.com', 'cleaning@pattenarms.com'],
      }
      const altEmails = fallbacks[loginEmail] || []
      for (const alt of altEmails) {
        const retry = await supabase.auth.signInWithPassword({ email: alt, password })
        if (!retry.error && retry.data.user) {
          data = retry.data
          error = null
          break
        }
      }
    }

    if (error) {
      toast.error(error.message || 'Invalid login credentials')
      setLoading(false)
      return
    }

    if (data?.user) {
      // Set active session marker for inactivity tracking
      try {
        localStorage.setItem('patten_hotel_last_activity', Date.now().toString())
        sessionStorage.setItem('patten_hotel_last_activity', Date.now().toString())
      } catch (e) {
        // ignore
      }

      // Determine destination by logged-in user email
      const signedInEmail = data.user.email?.toLowerCase() || ''
      if (signedInEmail.startsWith('dev') || signedInEmail.includes('uvdigital')) {
        router.push('/admin')
      } else if (signedInEmail.startsWith('info') || signedInEmail.startsWith('foh') || signedInEmail.startsWith('frontdesk')) {
        router.push('/frontdesk')
      } else if (signedInEmail.startsWith('housekeeping') || signedInEmail.startsWith('clean')) {
        router.push('/housekeeping')
      } else if (signedInEmail.startsWith('bookings')) {
        router.push('/admin/bookings')
      } else if (signedInEmail.startsWith('accounts')) {
        router.push('/admin/payments')
      } else {
        router.push('/admin')
      }
      router.refresh()
    }
    setLoading(false)
  }

  const activeRoleConfig = ROLES.find(r => r.id === selectedRole) || ROLES[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Image
              src="/logo.jpg"
              alt="The Patten Arms Hotel"
              width={220}
              height={100}
              className="h-20 w-auto object-contain drop-shadow-lg"
              priority
              unoptimized
            />
          </div>
          <p className="text-slate-400 text-xs sm:text-sm">Hotel Management System Portal</p>
        </div>

        {/* Quick Role Switcher Pills */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-800/90 border border-slate-700 p-1.5 rounded-2xl mb-4 shadow-lg">
          {ROLES.map(role => {
            const isSelected = selectedRole === role.id
            const Icon = role.icon
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleRoleSelect(role)}
                className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate max-w-full">{role.label}</span>
              </button>
            )
          })}
        </div>

        {/* Login Form Box */}
        <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-700">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/60">
            <div>
              <p className="text-white text-sm font-bold">{activeRoleConfig.label} Sign In</p>
              <p className="text-slate-400 text-xs mt-0.5">{activeRoleConfig.tag} Access</p>
            </div>
            <span className="text-[11px] font-mono text-blue-400 bg-blue-950/80 border border-blue-800/50 px-2.5 py-1 rounded-lg">
              {activeRoleConfig.email}
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address or Username
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. manager@pattenarms.co.uk"
                required
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md text-sm mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in...' : `Sign In to ${activeRoleConfig.label}`}
            </button>
          </form>
        </div>

        {/* Footer Branding */}
        <div className="flex items-center justify-center gap-2 text-slate-400 text-xs mt-6 opacity-85 hover:opacity-100 transition-opacity">
          <span>Created by</span>
          <Image
            src="/uv-digital-logo.png"
            alt="UV Digital"
            width={50}
            height={50}
            className="h-[50px] w-[50px] object-contain rounded-md inline-block shadow-sm"
            unoptimized
          />
        </div>
      </div>
    </div>
  )
}
