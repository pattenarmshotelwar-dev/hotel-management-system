'use client'

import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Phone,
  Wifi,
  Save,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  WhatsAppSettings,
  WhatsAppTemplate,
  DEFAULT_WHATSAPP_SETTINGS,
  DEFAULT_WHATSAPP_TEMPLATES,
  getSavedWhatsAppSettings,
  saveWhatsAppSettings,
  formatWhatsAppTemplate,
  createWhatsAppDispatchUrl,
} from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

interface WhatsAppSettingsTabProps {
  hotelConfig: any
}

// Sample mock data for live template preview
const MOCK_PREVIEW_DATA = {
  guest_name: 'John Smith',
  booking_reference: 'BK-7FA891',
  room_number: '204',
  room_type: 'Double Room',
  floor: '2',
  check_in_date: 'Fri, 26 Sep 2026',
  check_out_date: 'Sun, 28 Sep 2026',
  check_in_time: '15:00',
  check_out_time: '11:00',
  total_amount: '180.00',
  wifi_network: 'Patten_Guest_WiFi',
  wifi_password: 'PattenArmsWelcome',
  hotel_phone: '+44 1925 650144',
  hotel_address: 'Parker Street, Warrington, WA1 1HG',
  google_review_link: 'https://g.page/r/pattenarmshotel/review',
  urgency_level: 'Normal Turnover',
  cleaning_portal_link: 'https://hotel-management-system-one-lovat.vercel.app/housekeeping',
  ticket_priority: 'Urgent',
  maintenance_issue: 'Shower pressure leak reported in en-suite bathroom',
}

export default function WhatsAppSettingsTab({ hotelConfig }: WhatsAppSettingsTabProps) {
  const [settings, setSettings] = useState<WhatsAppSettings>(DEFAULT_WHATSAPP_SETTINGS)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl_booking_confirm')
  const [testPhoneNumber, setTestPhoneNumber] = useState<string>('')
  const [copiedTag, setCopiedTag] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showApiSettings, setShowApiSettings] = useState(false)

  useEffect(() => {
    const loaded = getSavedWhatsAppSettings()
    setSettings(loaded)
    if (loaded.cleanerPhone) {
      setTestPhoneNumber(loaded.cleanerPhone)
    }
  }, [])

  const selectedTemplate = settings.templates.find(t => t.id === selectedTemplateId) || settings.templates[0]

  const handleUpdateTemplateText = (text: string) => {
    setSettings(prev => ({
      ...prev,
      templates: prev.templates.map(t =>
        t.id === selectedTemplate.id ? { ...t, template: text } : t
      ),
    }))
  }

  const handleToggleTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSettings(prev => ({
      ...prev,
      templates: prev.templates.map(t =>
        t.id === id ? { ...t, enabled: !t.enabled } : t
      ),
    }))
    const current = settings.templates.find(t => t.id === id)
    toast.success(`Template "${current?.name}" ${!current?.enabled ? 'enabled' : 'disabled'}`)
  }

  const handleInsertTag = (tag: string) => {
    const tagText = `{${tag}}`
    handleUpdateTemplateText(selectedTemplate.template + (selectedTemplate.template.endsWith(' ') ? '' : ' ') + tagText)
    setCopiedTag(tag)
    setTimeout(() => setCopiedTag(null), 1500)
    toast.success(`Inserted ${tagText}`)
  }

  const handleResetTemplate = (id: string) => {
    const defaultTpl = DEFAULT_WHATSAPP_TEMPLATES.find(t => t.id === id)
    if (!defaultTpl) return
    if (confirm(`Reset "${defaultTpl.name}" back to original Patten Arms template?`)) {
      setSettings(prev => ({
        ...prev,
        templates: prev.templates.map(t =>
          t.id === id ? { ...t, template: defaultTpl.template, description: defaultTpl.description } : t
        ),
      }))
      toast.info('Template reset to default')
    }
  }

  const handleSaveAll = () => {
    setSaving(true)
    saveWhatsAppSettings(settings)
    setTimeout(() => {
      setSaving(false)
      toast.success('WhatsApp templates and messaging settings saved successfully!')
    }, 400)
  }

  // Generate live preview string using actual hotelConfig where applicable
  const previewVars = {
    ...MOCK_PREVIEW_DATA,
    wifi_network: hotelConfig?.wifiNetwork || MOCK_PREVIEW_DATA.wifi_network,
    wifi_password: hotelConfig?.wifiPassword || MOCK_PREVIEW_DATA.wifi_password,
    hotel_phone: hotelConfig?.phone || settings.frontDeskPhone || MOCK_PREVIEW_DATA.hotel_phone,
    hotel_address: hotelConfig?.address || MOCK_PREVIEW_DATA.hotel_address,
    google_review_link: hotelConfig?.googleReviewLink || MOCK_PREVIEW_DATA.google_review_link,
  }

  const previewFormatted = formatWhatsAppTemplate(selectedTemplate.template, previewVars)

  const handleSendTestWhatsApp = () => {
    if (!testPhoneNumber.trim()) {
      toast.error('Please enter a test phone number first')
      return
    }
    const url = createWhatsAppDispatchUrl(testPhoneNumber, previewFormatted, settings.defaultCountryCode)
    window.open(url, '_blank')
    toast.success('Opening WhatsApp preview...')
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Save Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">WhatsApp & SMS Messaging Configuration</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                1-Click Dispatch Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize guest greeting messages, WiFi passes, review prompts, and instant housekeeping turnover dispatches.
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save WhatsApp Config
        </button>
      </div>

      {/* Grid: Contact Numbers & Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Housekeeping Phone */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Housekeeping WhatsApp</h4>
          </div>
          <p className="text-[11px] text-slate-400">Cleaner mobile or WhatsApp team group number</p>
          <input
            type="text"
            value={settings.cleanerPhone}
            onChange={e => setSettings({ ...settings, cleanerPhone: e.target.value })}
            placeholder="+44 7700 900123"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Maintenance Lead Phone */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Maintenance Technician</h4>
          </div>
          <p className="text-[11px] text-slate-400">Dispatches urgent repairs and leak notifications</p>
          <input
            type="text"
            value={settings.maintenancePhone}
            onChange={e => setSettings({ ...settings, maintenancePhone: e.target.value })}
            placeholder="+44 7700 900456"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Default Country Dialing Code */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Default Country Code</h4>
          </div>
          <p className="text-[11px] text-slate-400">Auto-prefixes local numbers when dialing UK guests</p>
          <input
            type="text"
            value={settings.defaultCountryCode}
            onChange={e => setSettings({ ...settings, defaultCountryCode: e.target.value })}
            placeholder="+44"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Template Workspace: Left List + Right Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template Selector Tabs (4 cols) */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Message Templates</span>
            <span className="text-[11px] text-slate-400 font-medium">{settings.templates.length} Configured</span>
          </div>

          {settings.templates.map(tpl => {
            const isSelected = tpl.id === selectedTemplate.id
            return (
              <div
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={cn(
                  'p-3.5 rounded-xl border transition-all cursor-pointer text-left',
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                        tpl.target === 'guest'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      )}
                    >
                      {tpl.target === 'guest' ? 'Guest' : 'Staff'}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 truncate">{tpl.name}</h3>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleToggleTemplate(tpl.id, e)}
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full transition cursor-pointer shrink-0',
                      tpl.enabled
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-400'
                    )}
                    title={tpl.enabled ? 'Click to disable' : 'Click to enable'}
                  >
                    {tpl.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {tpl.description}
                </p>
              </div>
            )
          })}

          {/* Quick Help Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600 mt-4">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>How 1-Click WhatsApp Works</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              When Front Desk clicks WhatsApp on a booking or room, it generates an official direct link that opens WhatsApp Web or the WhatsApp desktop/mobile app with all details filled in ready to hit send.
            </p>
          </div>
        </div>

        {/* Right Column: Template Editor & Live Phone Preview (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{selectedTemplate.name}</h3>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      selectedTemplate.target === 'guest'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    )}
                  >
                    {selectedTemplate.target === 'guest' ? 'Sent to Guest' : 'Sent to Staff'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{selectedTemplate.trigger}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResetTemplate(selectedTemplate.id)}
                  className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
                >
                  Reset Default
                </button>
              </div>
            </div>

            {/* Dynamic Variable Insertion Pills */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Click Tag to Insert into Template
              </label>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  'guest_name',
                  'room_number',
                  'room_type',
                  'booking_reference',
                  'check_in_date',
                  'check_out_date',
                  'check_in_time',
                  'check_out_time',
                  'wifi_network',
                  'wifi_password',
                  'hotel_phone',
                  'hotel_address',
                  'google_review_link',
                  'total_amount',
                  'floor',
                  'cleaning_portal_link',
                  'ticket_priority',
                  'maintenance_issue',
                ].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInsertTag(tag)}
                    className={cn(
                      'px-2 py-1 rounded-lg font-mono text-[11px] transition flex items-center gap-1 cursor-pointer',
                      copiedTag === tag
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/80'
                    )}
                  >
                    <span>{`{${tag}}`}</span>
                    {copiedTag === tag && <Check className="w-2.5 h-2.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea Editor */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                WhatsApp Message Content
              </label>
              <textarea
                rows={9}
                value={selectedTemplate.template}
                onChange={e => handleUpdateTemplateText(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono leading-relaxed focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition resize-y"
              />
              <p className="text-[11px] text-slate-400">
                💡 <strong>Tip:</strong> Wrap text in single asterisks like <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">*bold*</code> to make text bold on WhatsApp.
              </p>
            </div>

            {/* Live WhatsApp Smartphone Preview */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  Live WhatsApp Message Preview (Sample Data)
                </span>
                <span className="text-[10px] text-slate-400">Renders live on WhatsApp</span>
              </div>

              {/* Chat Bubble Simulation */}
              <div className="p-4 bg-[#EFEAE2] rounded-2xl border border-[#D9D3C7] shadow-inner space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-[#D9D3C7]/60">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                    PA
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">Patten Arms Hotel</p>
                    <p className="text-[10px] text-slate-500">Official Guest Notification Service</p>
                  </div>
                </div>

                <div className="max-w-md bg-white p-3.5 rounded-2xl rounded-tl-none shadow-xs text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed border border-slate-100">
                  {previewFormatted}
                  <div className="text-right text-[10px] text-slate-400 mt-1 font-mono">
                    10:42 ✓✓
                  </div>
                </div>
              </div>

              {/* Test Dispatch Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <input
                    type="text"
                    placeholder="Enter phone to test (e.g. +447700900123)"
                    value={testPhoneNumber}
                    onChange={e => setTestPhoneNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendTestWhatsApp}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test to WhatsApp</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                </button>
              </div>
            </div>
          </div>

          {/* Optional Background API Gateway Accordion */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div
              onClick={() => setShowApiSettings(!showApiSettings)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Automated Background Dispatch via Twilio / Meta API (Optional)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Currently using instant 1-Click WhatsApp links (100% free). Expand to configure headless cloud dispatch.
                  </p>
                </div>
              </div>
              <span className="text-xs text-blue-600 font-semibold hover:underline">
                {showApiSettings ? 'Hide' : 'Configure'}
              </span>
            </div>

            {showApiSettings && (
              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Twilio Account SID
                  </label>
                  <input
                    type="text"
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={settings.twilioAccountSid || ''}
                    onChange={e => setSettings({ ...settings, twilioAccountSid: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Twilio Auth Token
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••••••••••••••••••"
                    value={settings.twilioAuthToken || ''}
                    onChange={e => setSettings({ ...settings, twilioAuthToken: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Twilio WhatsApp Number
                  </label>
                  <input
                    type="text"
                    placeholder="whatsapp:+14155238886"
                    value={settings.twilioWhatsAppNumber || ''}
                    onChange={e => setSettings({ ...settings, twilioWhatsAppNumber: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
