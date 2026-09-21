import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Allow public routes and static assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/ical/export') ||
    pathname.startsWith('/api/payments/webhook') ||
    pathname.startsWith('/api/invoices/generate') ||
    pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|pdf|txt)$/i)
  ) {
    if (user && pathname === '/login') {
      const url = request.nextUrl.clone()
      const email = user.email?.toLowerCase() || ''
      if (email === 'frontdesk@patternarmswarhotel.co.uk' || email.startsWith('frontdesk')) {
        url.pathname = '/frontdesk'
      } else if (email.startsWith('housekeeping')) {
        url.pathname = '/housekeeping'
      } else {
        url.pathname = '/admin'
      }
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return redirectResponse
    }
    return supabaseResponse
  }

  // Protect all internal routes and APIs
  if (!user) {
    // Return standard JSON 401 for unauthorized API requests
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Session authentication required' }, { status: 401 })
    }

    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Strict role separation:
  const userEmail = user.email?.toLowerCase() || ''
  const isFrontDesk = userEmail === 'frontdesk@patternarmswarhotel.co.uk' || userEmail.startsWith('frontdesk')
  const isHousekeeping = userEmail.startsWith('housekeeping')

  // Front desk cannot access admin or housekeeping routes
  if (isFrontDesk && (pathname.startsWith('/admin') || pathname.startsWith('/housekeeping'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/frontdesk'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Housekeeping cannot access admin or frontdesk routes
  if (isHousekeeping && (pathname.startsWith('/admin') || pathname.startsWith('/frontdesk'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/housekeeping'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|txt)$|api/payments/webhook).*)',
  ],
}
