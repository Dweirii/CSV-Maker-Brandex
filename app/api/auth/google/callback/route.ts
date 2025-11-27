import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/google/auth'

/**
 * GET /api/auth/google/callback
 * 
 * OAuth callback endpoint that Google redirects to after user approval.
 * Exchanges the authorization code for access and refresh tokens.
 * Stores tokens in secure HTTP-only cookies.
 * 
 * Flow:
 * 1. User approves permissions on Google
 * 2. Google redirects here with authorization code
 * 3. Exchange code for tokens
 * 4. Store tokens in cookies
 * 5. Redirect back to app
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const code = searchParams.get('code')
        const error = searchParams.get('error')

        // Handle OAuth errors (user denied access, etc.)
        if (error) {
            console.error('[Google Auth Callback] OAuth error:', error)

            return NextResponse.redirect(
                new URL(`/?error=google_auth_${error}`, request.url)
            )
        }

        // Validate authorization code
        if (!code) {
            console.error('[Google Auth Callback] Missing authorization code')

            return NextResponse.redirect(
                new URL('/?error=missing_code', request.url)
            )
        }

        console.log('[Google Auth Callback] Exchanging code for tokens')

        // Exchange code for access and refresh tokens
        const tokens = await exchangeCodeForTokens(code)

        console.log('[Google Auth Callback] Tokens received, setting cookies')

        // Create response that redirects back to home page
        const response = NextResponse.redirect(new URL('/?auth=success', request.url))

        // Store tokens in secure HTTP-only cookies
        // These cookies are NOT accessible via JavaScript (security against XSS)
        const cookieOptions = {
            httpOnly: true, // Prevents JavaScript access
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'lax' as const, // CSRF protection
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        }

        response.cookies.set('google_access_token', tokens.accessToken, cookieOptions)

        if (tokens.refreshToken) {
            response.cookies.set('google_refresh_token', tokens.refreshToken, cookieOptions)
        }

        if (tokens.expiryDate) {
            response.cookies.set(
                'google_token_expiry',
                tokens.expiryDate.toString(),
                cookieOptions
            )
        }

        console.log('[Google Auth Callback] Authentication successful, redirecting to app')

        return response
    } catch (error) {
        console.error('[Google Auth Callback] Token exchange failed:', error)

        return NextResponse.redirect(
            new URL('/?error=token_exchange_failed', request.url)
        )
    }
}
