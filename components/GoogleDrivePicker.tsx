"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Cloud, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { loadPickerApi, createPicker, validateSelectedFiles, type DriveFile } from "@/lib/google/picker"
import { toast } from "react-hot-toast"

interface GoogleDrivePickerProps {
    onFilesSelected: (files: File[]) => void
    disabled?: boolean
}

/**
 * GoogleDrivePicker Component
 * 
 * Provides a button that opens Google's file picker to select files from Drive.
 * Downloads selected files and converts them to File objects for processing.
 * 
 * Features:
 * - OAuth authentication check
 * - Multi-file selection
 * - File type filtering (images, PDFs, archives)
 * - Automatic file download from Drive
 * - Progress feedback
 * 
 * Usage:
 * <GoogleDrivePicker onFilesSelected={(files) => console.log(files)} />
 */
export function GoogleDrivePicker({ onFilesSelected, disabled }: GoogleDrivePickerProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isCheckingAuth, setIsCheckingAuth] = useState(true)
    const [isDownloading, setIsDownloading] = useState(false)
    const [pickerApiLoaded, setPickerApiLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Check authentication status on mount
    useEffect(() => {
        checkAuthStatus()

        // Check for auth success in URL (after OAuth callback)
        const params = new URLSearchParams(window.location.search)
        if (params.get('auth') === 'success') {
            toast.success('Successfully connected to Google Drive!')
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname)
            setIsAuthenticated(true)
        }

        // Check for auth errors
        const authError = params.get('error')
        if (authError) {
            toast.error(`Google Drive authentication failed: ${authError}`)
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [])

    /**
     * Checks if user is authenticated with Google Drive
     */
    const checkAuthStatus = async () => {
        try {
            const response = await fetch('/api/google/download')
            const data = await response.json()

            setIsAuthenticated(data.authenticated && !data.expired)
            setIsCheckingAuth(false)
        } catch (error) {
            console.error('[GoogleDrivePicker] Auth check failed:', error)
            setIsCheckingAuth(false)
        }
    }

    /**
     * Initiates OAuth flow by redirecting to Google
     */
    const handleAuthenticate = () => {
        window.location.href = '/api/auth/google'
    }

    /**
     * Fetches Google Picker configuration (API key, App ID) from the server
     */
    const fetchPickerConfig = async () => {
        const response = await fetch('/api/google/config')

        if (!response.ok) {
            let message = 'Failed to load Google Drive configuration'
            try {
                const data = await response.json()
                message = data.error || message
            } catch {
                // ignore JSON parsing errors – use default message
            }
            throw new Error(message)
        }

        return response.json() as Promise<{ apiKey: string; appId?: string }>
    }

    /**
   * Opens the Google Picker to select files
   */
    const handleOpenPicker = async () => {
        try {
            setError(null)

            // Load Picker API if not already loaded
            if (!pickerApiLoaded) {
                toast.loading('Loading Google Drive picker...', { id: 'picker-loading' })
                await loadPickerApi()
                setPickerApiLoaded(true)
                toast.dismiss('picker-loading')
            }

            // Get API key + app ID from server (allows runtime secrets)
            toast.loading('Preparing Google Drive picker...', { id: 'picker-config' })
            const { apiKey, appId } = await fetchPickerConfig().finally(() => {
                toast.dismiss('picker-config')
            })

            // Get access token from server
            toast.loading('Getting access token...', { id: 'getting-token' })
            const tokenResponse = await fetch('/api/google/token')

            if (!tokenResponse.ok) {
                throw new Error('Failed to get access token. Please reconnect to Google Drive.')
            }

            const { accessToken } = await tokenResponse.json()
            toast.dismiss('getting-token')

            if (!accessToken) {
                throw new Error('No access token available. Please reconnect to Google Drive.')
            }

            console.log('[GoogleDrivePicker] Opening picker with valid token')

            // Create and show picker with real access token
            createPicker(
                accessToken,
                apiKey,
                handleFilesSelected,
                {
                    appId,
                    onCancel: () => {
                        console.log('[GoogleDrivePicker] Picker cancelled')
                    },
                }
            )
        } catch (error) {
            console.error('[GoogleDrivePicker] Failed to open picker:', error)
            toast.dismiss('getting-token')
            setError(error instanceof Error ? error.message : 'Failed to open file picker')
            toast.error('Failed to open Google Drive picker')
        }
    }

    /**
     * Handles files selected from the picker
     * Downloads them from Drive and converts to File objects
     */
    const handleFilesSelected = async (driveFiles: DriveFile[]) => {
        try {
            // Validate selection
            const validation = validateSelectedFiles(driveFiles)
            if (!validation.valid) {
                toast.error(validation.error || 'Invalid file selection')
                return
            }

            setIsDownloading(true)
            toast.loading(`Downloading ${driveFiles.length} files from Google Drive...`, {
                id: 'drive-download',
            })

            console.log('[GoogleDrivePicker] Downloading files:', driveFiles)

            // Download files from Drive via API
            const response = await fetch('/api/google/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    files: driveFiles.map((f) => ({
                        id: f.id,
                        name: f.name,
                        mimeType: f.mimeType,
                    })),
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Download failed')
            }

            const data = await response.json()

            toast.dismiss('drive-download')

            // Show warnings for any failed downloads
            if (data.errors && data.errors.length > 0) {
                console.warn('[GoogleDrivePicker] Some files failed:', data.errors)
                toast.error(`${data.errors.length} file(s) failed to download`, {
                    duration: 5000,
                })
            }

            // Convert base64 data to File objects
            const files: File[] = await Promise.all(
                data.files.map(async (fileData: any) => {
                    // Decode base64 to binary
                    const binaryString = atob(fileData.data)
                    const bytes = new Uint8Array(binaryString.length)
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i)
                    }

                    // Create File object
                    return new File([bytes], fileData.name, {
                        type: fileData.type,
                    })
                })
            )

            console.log('[GoogleDrivePicker] Converted to File objects:', files.length)

            toast.success(`Successfully imported ${files.length} files from Google Drive!`)

            // Pass files to parent component
            onFilesSelected(files)
        } catch (error) {
            console.error('[GoogleDrivePicker] Download failed:', error)
            toast.error(
                error instanceof Error ? error.message : 'Failed to download files from Google Drive'
            )
            setError(error instanceof Error ? error.message : 'Download failed')
        } finally {
            setIsDownloading(false)
        }
    }

    // Loading state
    if (isCheckingAuth) {
        return (
            <Button disabled variant="outline" className="w-full">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking Google Drive connection...
            </Button>
        )
    }

    // Not authenticated - show connect button
    if (!isAuthenticated) {
        return (
            <div className="space-y-3">
                <Button
                    onClick={handleAuthenticate}
                    disabled={disabled}
                    variant="outline"
                    className="w-full border-blue-200 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-800 dark:hover:bg-blue-950/20"
                >
                    <Cloud className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Connect to Google Drive
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                    Connect once to select files directly from your Google Drive
                </p>
            </div>
        )
    }

    // Authenticated - show picker button
    return (
        <div className="space-y-3">
            <Button
                onClick={handleOpenPicker}
                disabled={disabled || isDownloading}
                variant="outline"
                className="w-full border-green-200 hover:bg-green-50 hover:border-green-300 dark:border-green-800 dark:hover:bg-green-950/20"
            >
                {isDownloading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Downloading from Drive...
                    </>
                ) : (
                    <>
                        <Cloud className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
                        Select from Google Drive
                    </>
                )}
            </Button>

            {error && (
                <Alert variant="destructive" className="text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <p className="text-xs text-muted-foreground text-center">
                ✓ Connected to Google Drive
            </p>
        </div>
    )
}
