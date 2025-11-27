/**
 * Google Drive File Picker Integration
 * 
 * This module provides utilities for loading and configuring the Google Picker API
 * to allow users to select files from their Google Drive.
 */

/**
 * Metadata for a file selected from Google Drive
 */
export interface DriveFile {
    id: string
    name: string
    mimeType: string
    sizeBytes?: number
    iconUrl?: string
    url?: string
}

/**
 * Accepted file MIME types for product imports
 * Images for product display, archives and PDFs for download files
 */
const ACCEPTED_MIME_TYPES = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-zip-compressed',
    // Documents
    'application/pdf',
    // Photoshop
    'image/vnd.adobe.photoshop',
    'application/x-photoshop',
]

/**
 * Loads the Google Picker API script
 * Must be called before creating a picker
 * 
 * @returns Promise that resolves when the API is loaded
 */
export function loadPickerApi(): Promise<void> {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.google?.picker) {
            resolve()
            return
        }

        // Load the API
        const script = document.createElement('script')
        script.src = 'https://apis.google.com/js/api.js'
        script.onload = () => {
            window.gapi.load('picker', {
                callback: () => {
                    console.log('[Google Picker] API loaded successfully')
                    resolve()
                },
                onerror: (error: any) => {
                    console.error('[Google Picker] Failed to load picker:', error)
                    reject(new Error('Failed to load Google Picker API'))
                },
            })
        }
        script.onerror = () => {
            reject(new Error('Failed to load Google API script'))
        }

        document.head.appendChild(script)
    })
}

/**
 * Creates and shows a Google Drive file picker
 * 
 * @param accessToken - Valid Google OAuth access token
 * @param apiKey - Google API key for picker initialization
 * @param onSelect - Callback function called when files are selected
 * @param onCancel - Optional callback when picker is closed without selection
 * @returns Google Picker instance
 */
export function createPicker(
    accessToken: string,
    apiKey: string,
    onSelect: (files: DriveFile[]) => void,
    options?: {
        onCancel?: () => void
        appId?: string
    }
): google.picker.Picker {
    const pickerBuilder = new google.picker.PickerBuilder()
        // Add Drive view with multi-select enabled
        .addView(
            new google.picker.DocsView()
                .setIncludeFolders(false)
                .setMimeTypes(ACCEPTED_MIME_TYPES.join(','))
                .setMode(google.picker.DocsViewMode.LIST)
        )
        // Enable multi-select (up to 100 files - matching your file limit)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        // Set OAuth token
        .setOAuthToken(accessToken)
        // Set API key
        .setDeveloperKey(apiKey)

    if (options?.appId) {
        pickerBuilder.setAppId(options.appId)
    }

    const picker = pickerBuilder
        // Set callback
        .setCallback((data: google.picker.ResponseObject) => {
            if (data.action === google.picker.Action.PICKED) {
                const files: DriveFile[] = data.docs.map((doc) => ({
                    id: doc.id,
                    name: doc.name,
                    mimeType: doc.mimeType,
                    sizeBytes: doc.sizeBytes,
                    iconUrl: doc.iconUrl,
                    url: doc.url,
                }))

                console.log('[Google Picker] Files selected:', files.length)
                onSelect(files)
            } else if (data.action === google.picker.Action.CANCEL) {
                console.log('[Google Picker] Picker cancelled')
                options?.onCancel?.()
            }
        })
        // Set locale and title
        .setTitle('Select Product Files from Google Drive')
        .setLocale('en')
        .build()

    // Show the picker
    picker.setVisible(true)

    return picker
}

/**
 * Validates selected files against business rules
 * - Checks file count limit (max 200 files = 100 pairs)
 * - Validates file types
 * 
 * @param files - Selected Drive files
 * @returns Validation result with error message if invalid
 */
export function validateSelectedFiles(files: DriveFile[]): {
    valid: boolean
    error?: string
} {
    if (files.length === 0) {
        return { valid: false, error: 'No files selected' }
    }

    if (files.length > 200) {
        return {
            valid: false,
            error: `Too many files selected. Maximum is 200 (100 pairs), you selected ${files.length}`,
        }
    }

    // Check for invalid MIME types
    const invalidFiles = files.filter(
        (file) => !ACCEPTED_MIME_TYPES.includes(file.mimeType)
    )

    if (invalidFiles.length > 0) {
        return {
            valid: false,
            error: `${invalidFiles.length} file(s) have unsupported types. Only images, PDFs, and archives are allowed.`,
        }
    }

    return { valid: true }
}

/**
 * Type declarations for Google Picker API
 * These extend the global window object
 */
declare global {
    interface Window {
        google: {
            picker: typeof google.picker
        }
        gapi: {
            load: (api: string, options: { callback: () => void; onerror?: (error: any) => void }) => void
        }
    }
}

declare namespace google.picker {
    class PickerBuilder {
        addView(view: View): PickerBuilder
        enableFeature(feature: Feature): PickerBuilder
        setOAuthToken(token: string): PickerBuilder
        setDeveloperKey(key: string): PickerBuilder
        setAppId(appId: string): PickerBuilder
        setCallback(callback: (data: ResponseObject) => void): PickerBuilder
        setTitle(title: string): PickerBuilder
        setLocale(locale: string): PickerBuilder
        build(): Picker
    }

    class DocsView implements View {
        setIncludeFolders(include: boolean): DocsView
        setMimeTypes(mimeTypes: string): DocsView
        setMode(mode: DocsViewMode): DocsView
    }

    interface View { }

    interface Picker {
        setVisible(visible: boolean): void
    }

    interface ResponseObject {
        action: Action
        docs: Document[]
    }

    interface Document {
        id: string
        name: string
        mimeType: string
        sizeBytes: number
        iconUrl: string
        url: string
    }

    enum Action {
        PICKED = 'picked',
        CANCEL = 'cancel',
    }

    enum Feature {
        MULTISELECT_ENABLED = 'multiselectEnabled',
    }

    enum DocsViewMode {
        LIST = 'list',
        GRID = 'grid',
    }
}
