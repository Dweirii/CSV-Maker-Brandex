import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/google/auth'

/**
 * GET /api/google/token
 * 
 * Returns a valid access token for the Google Picker API
 * This endpoint safely provides the token from HTTP-only cookies
 * without exposing the cookie itself to JavaScript
 * 
 * Security: The token is short-lived and read-only scoped
 */
export async function GET(request: NextRequest) {
    try {
        // Get tokens from HTTP-only cookies
        const accessToken = request.cookies.get('google_access_token')?.value
        const refreshToken = request.cookies.get('google_refresh_token')?.value
        const expiryDate = request.cookies.get('google_token_expiry')?.value

        // Check authentication
        if (!accessToken) {
            return NextResponse.json(
                { error: 'Not authenticated with Google Drive' },
                { status: 401 }
            )
        }

        // Get valid access token (will refresh if expired)
        const tokenResult = await getValidAccessToken(
            accessToken,
            refreshToken,
            expiryDate ? parseInt(expiryDate) : undefined
        )

        // If token was refreshed, update cookies
        const response = NextResponse.json({
            accessToken: tokenResult.accessToken,
        })

        if (tokenResult.refreshed) {
            console.log('[Google Token] Token was refreshed, updating cookies')

            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax' as const,
                maxAge: 60 * 60 * 24 * 7, // 7 days
                path: '/',
            }

            response.cookies.set('google_access_token', tokenResult.accessToken, cookieOptions)

            if (tokenResult.expiryDate) {
                response.cookies.set(
                    'google_token_expiry',
                    tokenResult.expiryDate.toString(),
                    cookieOptions
                )
            }
        }

        return response
    } catch (error) {
        console.error('[Google Token] Failed to get token:', error)

        return NextResponse.json(
            {
                error: 'Failed to get access token',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
