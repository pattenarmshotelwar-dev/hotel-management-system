'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<'admin' | 'housekeeping'>('admin')

  // Housekeeping shared credentials (stored in env on client)
  const HOUSEKEEPING_EMAIL = process.env.NEXT_PUBLIC_HOUSEKEEPING_EMAIL || 'housekeeping@hotel.com'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Set active session marker for tab-close & inactivity tracking
      sessionStorage.setItem('patten_hotel_session_active', 'true')
      sessionStorage.setItem('patten_hotel_last_activity', Date.now().toString())

      // Determine role by email
      if (data.user.email === HOUSEKEEPING_EMAIL) {
        router.push('/housekeeping')
      } else {
        router.push('/admin')
      }
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.jpg"
              alt="The Patten Arms Hotel"
              width={200}
              height={100}
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>
          <p className="text-slate-400 mt-1">Sign in to your dashboard</p>
        </div>

        {/* Role Tabs */}
        <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setRole('admin'); setEmail(''); setPassword('') }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              role === 'admin'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Management
          </button>
          <button
            onClick={() => { setRole('housekeeping'); setEmail(HOUSEKEEPING_EMAIL); setPassword('') }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              role === 'housekeeping'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Housekeeping
          </button>
        </div>

        {/* Login Form */}
        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
          <form onSubmit={handleLogin} className="space-y-5">
            {role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hotel.com"
                  required
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            )}

            {role === 'housekeeping' && (
              <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                <p className="text-slate-300 text-sm font-medium">Housekeeping Team Login</p>
                <p className="text-slate-400 text-xs mt-1">Enter the shared housekeeping password below</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12"
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
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Created by UVDigital
        </p>
      </div>
    </div>
  )
}
