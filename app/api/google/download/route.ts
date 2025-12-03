import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getOAuth2Client, getValidAccessToken } from '@/lib/google/auth'
import { Readable } from 'stream'

/**
 * POST /api/google/download
 * 
 * Downloads files from Google Drive and converts them to File objects
 * that can be processed by the existing file upload pipeline.
 * 
 * Security: Requires valid access token stored in HTTP-only cookies
 * 
 * Request body:
 * {
 *   files: Array<{ id: string, name: string, mimeType: string }>
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   files: Array<{ name: string, data: base64_string, type: string, size: number }>
 * }
 */
export async function POST(request: NextRequest) {
    try {
        // Get tokens from cookies
        const accessToken = request.cookies.get('google_access_token')?.value
        const refreshToken = request.cookies.get('google_refresh_token')?.value
        const expiryDate = request.cookies.get('google_token_expiry')?.value

        // Validate authentication
        if (!accessToken) {
            console.error('[Google Download] No access token found in cookies')
            return NextResponse.json(
                { error: 'Not authenticated. Please connect to Google Drive first.' },
                { status: 401 }
            )
        }

        // Parse request body
        const body = await request.json()
        const { files } = body as {
            files: Array<{ id: string; name: string; mimeType: string }>
        }

        // Validate request
        if (!files || !Array.isArray(files) || files.length === 0) {
            return NextResponse.json(
                { error: 'No files specified for download' },
                { status: 400 }
            )
        }

        // Increased limit to support IMAGES category (5000 files)
        // Other categories are validated client-side before reaching here
        if (files.length > 5000) {
            return NextResponse.json(
                { error: 'Too many files. Maximum is 5000 files per request.' },
                { status: 400 }
            )
        }

        console.log(`[Google Download] Downloading ${files.length} files from Drive`)

        // Get valid access token (refresh if expired)
        const tokenResult = await getValidAccessToken(
            accessToken,
            refreshToken,
            expiryDate ? parseInt(expiryDate) : undefined
        )

        // Create response object - will be used if token was refreshed
        let response: NextResponse | null = null

        // If token was refreshed, we need to update the cookies
        if (tokenResult.refreshed) {
            console.log('[Google Download] Token was refreshed, updating cookies')
            response = new NextResponse()

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

        // Initialize Google Drive API
        const oauth2Client = getOAuth2Client()
        oauth2Client.setCredentials({ access_token: tokenResult.accessToken })
        const drive = google.drive({ version: 'v3', auth: oauth2Client })

        // Download files with concurrency control (5 at a time to avoid rate limits)
        const downloadFile = async (file: { id: string; name: string; mimeType: string }) => {
            try {
                console.log(`[Google Download] Downloading file: ${file.name}`)

                // Download file data
                const response = await drive.files.get(
                    {
                        fileId: file.id,
                        alt: 'media', // Download actual file content
                    },
                    {
                        responseType: 'arraybuffer', // Get binary data
                        timeout: 120000, // 2 minute timeout per file
                    }
                )

                const buffer = Buffer.from(response.data as ArrayBuffer)

                console.log(`[Google Download] Downloaded ${file.name} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`)

                return {
                    name: file.name,
                    data: buffer.toString('base64'), // Convert to base64 for JSON transfer
                    type: file.mimeType,
                    size: buffer.length,
                }
            } catch (error) {
                console.error(`[Google Download] Failed to download ${file.name}:`, error)
                throw new Error(`Failed to download ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }

        // Process files with concurrency limit
        const downloadPromises: Promise<any>[] = []
        const results: any[] = []
        const errors: string[] = []

        for (let i = 0; i < files.length; i += 5) {
            const batch = files.slice(i, i + 5)
            const batchResults = await Promise.allSettled(batch.map(downloadFile))

            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value)
                } else {
                    errors.push(`${batch[index].name}: ${result.reason?.message || 'Download failed'}`)
                }
            })
        }

        // Check if any files were successfully downloaded
        if (results.length === 0) {
            return NextResponse.json(
                {
                    error: 'All file downloads failed',
                    details: errors,
                },
                { status: 500 }
            )
        }

        console.log(`[Google Download] Successfully downloaded ${results.length}/${files.length} files`)

        // Return successful downloads (partial success is OK)
        const responseData = {
            success: true,
            files: results,
            errors: errors.length > 0 ? errors : undefined,
        }

        if (response) {
            // Token was refreshed, return response with updated cookies
            return NextResponse.json(responseData, {
                status: 200,
                headers: response.headers,
            })
        }

        return NextResponse.json(responseData)
    } catch (error) {
        console.error('[Google Download] Request failed:', error)

        return NextResponse.json(
            {
                error: 'Failed to download files from Google Drive',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}

/**
 * GET /api/google/download
 * 
 * Checks if user is authenticated with Google Drive
 * Used by frontend to determine if Drive picker can be used
 */
export async function GET(request: NextRequest) {
    const accessToken = request.cookies.get('google_access_token')?.value
    const expiryDate = request.cookies.get('google_token_expiry')?.value

    const isAuthenticated = !!accessToken
    const isExpired = expiryDate ? parseInt(expiryDate) <= Date.now() : true

    return NextResponse.json({
        authenticated: isAuthenticated,
        expired: isExpired,
        needsRefresh: isAuthenticated && isExpired,
    })
}
