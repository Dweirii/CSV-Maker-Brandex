import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google/auth'

/**
 * GET /api/auth/google
 * 
 * Initiates the Google OAuth flow by redirecting the user to Google's
 * authorization page where they can grant Drive read access.
 * 
 * Flow:
 * 1. User clicks "Select from Google Drive"
 * 2. This endpoint redirects to Google OAuth consent screen
 * 3. User approves permissions
 * 4. Google redirects to /api/auth/google/callback
 */
export async function GET(request: NextRequest) {
    try {
        console.log('[Google Auth] Starting OAuth flow')

        // Generate authorization URL with required scopes
        const authUrl = getAuthUrl()

        console.log('[Google Auth] Redirecting to Google consent screen')

        // Redirect user to Google OAuth page
        return NextResponse.redirect(authUrl)
    } catch (error) {
        console.error('[Google Auth] Failed to start OAuth flow:', error)

        return NextResponse.json(
            {
                error: 'Failed to start Google authentication',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
