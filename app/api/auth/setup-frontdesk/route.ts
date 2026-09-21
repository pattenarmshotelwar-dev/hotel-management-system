import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const setupSecretHeader = request.headers.get('x-setup-secret')
    const envSecret = process.env.ADMIN_SETUP_SECRET || process.env.CRON_SECRET

    // Check if caller has valid secret token or is authenticated management session
    let isAuthorized = false
    if (envSecret && (setupSecretHeader === envSecret || authHeader === `Bearer ${envSecret}`)) {
      isAuthorized = true
    } else {
      const serverSupabase = await createClient()
      const { data: { user } } = await serverSupabase.auth.getUser()
      const userEmail = user?.email?.toLowerCase() || ''
      // Only management/admin users can trigger user setup
      if (user && !userEmail.startsWith('frontdesk') && !userEmail.startsWith('housekeeping')) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized access to user provisioning' }, { status: 403 })
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Safety constraint: This endpoint can only provision the front desk account, not arbitrary admin accounts
    const targetEmail = email.toLowerCase().trim()
    if (targetEmail !== 'frontdesk@patternarmswarhotel.co.uk') {
      return NextResponse.json({ error: 'This endpoint can only provision the front desk service account' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // If service role key is available, use admin to create confirmed user
    if (serviceRoleKey) {
      const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })

      // Try creating user with email confirmed
      const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (!createError) {
        return NextResponse.json({ success: true, user: createData.user })
      }

      // If user already exists, update their password and confirm
      if (createError.message.toLowerCase().includes('already') || createError.message.toLowerCase().includes('exists')) {
        const { data: usersList } = await adminClient.auth.admin.listUsers()
        const existing = usersList?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
        if (existing) {
          await adminClient.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
          })
          return NextResponse.json({ success: true, updated: true })
        }
      }
    }

    // Fallback: Use standard signup
    const anonClient = createSupabaseClient(supabaseUrl, anonKey)
    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: signUpData.user })
  } catch (err: any) {
    console.error('Error in setup-frontdesk route:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
