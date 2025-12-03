import { NextResponse } from 'next/server'

/**
 * Provides runtime Google Picker configuration to the client.
 * This allows us to keep the API key in server-side secrets instead of
 * baking it into the client bundle during build time.
 */
export async function GET() {
    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_API_KEY

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Google API key not configured. Please contact support.' },
            { status: 500 }
        )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const appId = clientId ? clientId.split('.')[0] : undefined

    return NextResponse.json({
        apiKey,
        appId,
    })
}





