import { google } from 'googleapis'

/**
 * Google OAuth Configuration
 * Scopes: drive.readonly - Read-only access to Google Drive files
 */
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

/**
 * Validates that all required Google OAuth environment variables are set
 * @throws Error if any required variable is missing
 */
function validateEnvVars() {
    const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']
    const missing = required.filter((key) => !process.env[key])

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
}

/**
 * Creates and configures a Google OAuth2 client
 * @returns Configured OAuth2 client instance
 */
export function getOAuth2Client() {
    validateEnvVars()

    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        process.env.GOOGLE_REDIRECT_URI!
    )
}

/**
 * Generates the Google OAuth authorization URL
 * Users will be redirected here to grant permissions
 * 
 * @returns Authorization URL with required scopes and access type
 */
export function getAuthUrl(): string {
    const oauth2Client = getOAuth2Client()

    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Request refresh token
        scope: SCOPES,
        prompt: 'consent', // Force consent screen to get refresh token
    })
}

/**
 * Exchanges authorization code for access and refresh tokens
 * Called in the OAuth callback after user approves permissions
 * 
 * @param code - Authorization code from Google OAuth callback
 * @returns Object containing access_token, refresh_token, and expiry_date
 * @throws Error if token exchange fails
 */
export async function exchangeCodeForTokens(code: string) {
    try {
        const oauth2Client = getOAuth2Client()
        const { tokens } = await oauth2Client.getToken(code)

        if (!tokens.access_token) {
            throw new Error('No access token received from Google')
        }

        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date,
        }
    } catch (error) {
        console.error('[Google Auth] Token exchange failed:', error)
        throw new Error('Failed to exchange authorization code for tokens')
    }
}

/**
 * Refreshes an expired access token using a refresh token
 * Automatically called when access token expires
 * 
 * @param refreshToken - Valid refresh token from initial authorization
 * @returns New access token and expiry date
 * @throws Error if refresh fails
 */
export async function refreshAccessToken(refreshToken: string) {
    try {
        const oauth2Client = getOAuth2Client()
        oauth2Client.setCredentials({ refresh_token: refreshToken })

        const { credentials } = await oauth2Client.refreshAccessToken()

        if (!credentials.access_token) {
            throw new Error('No access token received from refresh')
        }

        return {
            accessToken: credentials.access_token,
            expiryDate: credentials.expiry_date,
        }
    } catch (error) {
        console.error('[Google Auth] Token refresh failed:', error)
        throw new Error('Failed to refresh access token. User may need to re-authenticate.')
    }
}

/**
 * Verifies if an access token is valid and not expired
 * 
 * @param accessToken - Access token to verify
 * @returns True if token is valid, false otherwise
 */
export async function verifyAccessToken(accessToken: string): Promise<boolean> {
    try {
        const oauth2Client = getOAuth2Client()
        oauth2Client.setCredentials({ access_token: accessToken })

        const tokenInfo = await oauth2Client.getTokenInfo(accessToken)
        return !!tokenInfo.expiry_date && tokenInfo.expiry_date > Date.now()
    } catch (error) {
        console.error('[Google Auth] Token verification failed:', error)
        return false
    }
}

/**
 * Gets a valid access token, refreshing if necessary
 * This is the main function to use when making Google API calls
 * 
 * @param accessToken - Current access token
 * @param refreshToken - Refresh token for getting new access token
 * @param expiryDate - Token expiry timestamp
 * @returns Valid access token and new expiry date (if refreshed)
 */
export async function getValidAccessToken(
    accessToken: string,
    refreshToken: string | undefined,
    expiryDate: number | undefined
): Promise<{ accessToken: string; expiryDate?: number; refreshed: boolean }> {
    // Check if token is still valid (with 5 minute buffer)
    const isExpired = !expiryDate || expiryDate <= Date.now() + 5 * 60 * 1000

    if (!isExpired) {
        return { accessToken, expiryDate, refreshed: false }
    }

    // Token expired, try to refresh
    if (!refreshToken) {
        throw new Error('Access token expired and no refresh token available')
    }

    console.log('[Google Auth] Access token expired, refreshing...')
    const refreshed = await refreshAccessToken(refreshToken)

    return {
        accessToken: refreshed.accessToken,
        expiryDate: refreshed.expiryDate ?? undefined,
        refreshed: true,
    }
}
