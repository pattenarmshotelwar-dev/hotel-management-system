'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin section error:', error)
  }, [error])

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Failed to load this section</h2>
        <p className="text-slate-500 text-sm mb-6">
          A temporary network or server error occurred while retrieving data. Click below to reload the section.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Section
        </button>
      </div>
    </div>
  )
}
