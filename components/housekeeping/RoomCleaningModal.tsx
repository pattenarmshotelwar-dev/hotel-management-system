'use client'

import { useState, useEffect, useMemo } from 'react'
import { Room } from '@/lib/types'
import { ROOM_CLEANING_CHECKLIST, ChecklistCategory } from '@/lib/cleaning-checklist'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Bed,
  Bath,
  Package,
  Coffee,
  Armchair,
  Tv,
  Check,
  RotateCcw,
} from 'lucide-react'

interface RoomCleaningModalProps {
  room: Room
  cleanerName: string
  onClose: () => void
  onComplete: (cleanedRoom: Room) => void
  onReportIssue: (room: Room, itemTitle?: string) => void
}

const CATEGORY_ICONS: Record<string, any> = {
  Bed,
  Sparkles,
  Package,
  Bath,
  Coffee,
  Armchair,
  Tv,
}

export default function RoomCleaningModal({
  room,
  cleanerName,
  onClose,
  onComplete,
  onReportIssue,
}: RoomCleaningModalProps) {
  const supabase = createClient()
  const storageKey = `cleaning_session_${room.id}`

  // Session state: restore or start fresh
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.checkedItems || {}
      }
    } catch (e) {}
    return {}
  })

  const [startTime, setStartTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.startTime) return parsed.startTime
      }
    } catch (e) {}
    return Date.now()
  })

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    // Expand first 2 by default
    return { bedding: true, bathroom_consumables: true, toiletries: true }
  })

  // Set room status to 'cleaning' in database on mount if not already
  useEffect(() => {
    const markInCleaning = async () => {
      if (room.cleaning_status !== 'cleaning') {
        await supabase.from('rooms').update({ cleaning_status: 'cleaning' }).eq('id', room.id)
      }
    }
    markInCleaning()
  }, [room.id])

  // Timer tick
  useEffect(() => {
    const updateTimer = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000))
      setElapsedSeconds(seconds)
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  // Persist session to local storage
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          checkedItems,
          startTime,
        })
      )
    } catch (e) {}
  }, [checkedItems, startTime, storageKey])

  // Total items calculations
  const allItems = useMemo(() => {
    return ROOM_CLEANING_CHECKLIST.flatMap(c => c.items)
  }, [])

  const totalItemsCount = allItems.length
  const checkedItemsCount = useMemo(() => {
    return Object.values(checkedItems).filter(Boolean).length
  }, [checkedItems])

  const completionPercent = Math.round((checkedItemsCount / totalItemsCount) * 100)

  // Toggle single item
  const toggleItem = (itemId: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }))
  }

  // Toggle entire category
  const toggleCategoryAll = (category: ChecklistCategory) => {
    const allCategoryItemsChecked = category.items.every(i => checkedItems[i.id])
    setCheckedItems(prev => {
      const next = { ...prev }
      category.items.forEach(i => {
        next[i.id] = !allCategoryItemsChecked
      })
      return next
    })
  }

  // Check all standard items (Routine Turn pass)
  const checkAllItems = () => {
    setCheckedItems(prev => {
      const next: Record<string, boolean> = { ...prev }
      allItems.forEach(i => {
        next[i.id] = true
      })
      return next
    })
    toast.success('All checklist items verified!')
  }

  // Format seconds to mm:ss
  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Complete and mark clean
  const handleFinishCleaning = async () => {
    setSubmitting(true)
    const startedIso = new Date(startTime).toISOString()
    const completedIso = new Date().toISOString()
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60))

    try {
      // 1. Update room status to clean
      const { error: roomErr } = await supabase
        .from('rooms')
        .update({
          cleaning_status: 'clean',
        })
        .eq('id', room.id)

      if (roomErr) throw roomErr

      // 2. Insert cleaning log record with audit details
      const logNotes = [
        `Full checklist verification: ${checkedItemsCount}/${totalItemsCount} items (${completionPercent}%)`,
        `Duration: ${durationMinutes} min`,
        notes.trim() ? `Cleaner Notes: ${notes.trim()}` : null,
      ]
        .filter(Boolean)
        .join(' | ')

      await supabase.from('cleaning_logs').insert({
        room_id: room.id,
        cleaner_name: cleanerName || 'Housekeeping Team',
        status_before: 'dirty',
        status_after: 'clean',
        started_at: startedIso,
        completed_at: completedIso,
        notes: logNotes,
      })

      // 3. Clear session
      try {
        localStorage.removeItem(storageKey)
      } catch (e) {}

      toast.success(`Room ${room.room_number} marked clean! (${durationMinutes} mins) ✓`)
      onComplete({ ...room, cleaning_status: 'clean' })
    } catch (err: any) {
      console.error('Error completing room clean:', err)
      toast.error('Failed to update room cleaning record')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Banner */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-lg text-blue-400">
              {room.room_number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg">Room {room.room_number}</h2>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full capitalize font-medium">
                  {room.room_type?.replace('_', ' ')} · Floor {room.floor}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cleaner: <span className="text-white font-medium">{cleanerName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Timer Badge */}
            <div className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-500/40 text-blue-300 px-3 py-1.5 rounded-xl text-xs font-mono font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Close without finalizing"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress & Quick Actions Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-semibold">Inspection Progress:</span>
              <span className="text-blue-600 font-bold">
                {checkedItemsCount} / {totalItemsCount} items
              </span>
            </div>
            <span className="font-bold text-slate-900">{completionPercent}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={checkAllItems}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              Verify All Standard Items
            </button>

            <button
              type="button"
              onClick={() => onReportIssue(room)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
              Report Maintenance Issue
            </button>
          </div>
        </div>

        {/* Checklist Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {ROOM_CLEANING_CHECKLIST.map(category => {
            const Icon = CATEGORY_ICONS[category.iconName] || Sparkles
            const isExpanded = !!expandedCategories[category.id]
            const categoryCheckedCount = category.items.filter(i => checkedItems[i.id]).length
            const isCategoryAllChecked = categoryCheckedCount === category.items.length

            return (
              <div
                key={category.id}
                className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs transition"
              >
                {/* Category Header Accordion */}
                <div
                  onClick={() =>
                    setExpandedCategories(p => ({ ...p, [category.id]: !p[category.id] }))
                  }
                  className="px-4 py-3 bg-slate-50 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between transition select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        {category.title}
                        {isCategoryAllChecked && (
                          <span className="text-[11px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.2 rounded-full">
                            Complete
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-400">{category.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-slate-500">
                      {categoryCheckedCount}/{category.items.length}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Items List */}
                {isExpanded && (
                  <div className="p-3 border-t border-slate-100 space-y-1.5">
                    {/* Category Fast Check */}
                    <div className="flex justify-end pb-1">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          toggleCategoryAll(category)
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition"
                      >
                        {isCategoryAllChecked ? 'Uncheck Section' : 'Check All Section'}
                      </button>
                    </div>

                    {category.items.map(item => {
                      const isChecked = !!checkedItems[item.id]
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition border ${
                            isChecked
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-white hover:bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                                isChecked
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span
                              className={`text-xs sm:text-sm font-medium ${
                                isChecked ? 'text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.isPremium && (
                              <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-1.5 py-0.5 rounded">
                                Premium
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                onReportIssue(room, item.label)
                              }}
                              className="text-slate-300 hover:text-orange-500 p-1 transition"
                              title="Flag issue with this item"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Cleaner Notes */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Cleaner Turn Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Left extra bath towels per guest request; minor scratch on bedside table..."
              className="w-full text-xs sm:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            />
          </div>
        </div>

        {/* Footer Confirmation */}
        <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Save & Exit Later
          </button>

          <button
            type="button"
            onClick={handleFinishCleaning}
            disabled={submitting}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Finish & Mark Clean ✓
          </button>
        </div>
      </div>
    </div>
  )
}
