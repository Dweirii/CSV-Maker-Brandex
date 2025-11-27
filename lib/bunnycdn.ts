import axios from "axios"

const BUNNYCDN_STORAGE_ZONE = process.env.BUNNYCDN_STORAGE_ZONE!
const BUNNYCDN_API_KEY = process.env.BUNNYCDN_API_KEY!
const BUNNYCDN_PULL_ZONE = process.env.BUNNYCDN_PULL_ZONE!

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

function getContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    psd: "image/vnd.adobe.photoshop",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    pdf: "application/pdf",
  }
  return types[ext] || "application/octet-stream"
}

import { Readable } from "stream"

export async function uploadToBunnyCDN(
  file: File | Buffer | Readable | ReadableStream,
  fileName: string,
  folder: "images" | "downloads" = "images"
): Promise<UploadResult> {
  try {
    let data: Buffer | Readable

    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer()
      data = Buffer.from(arrayBuffer)
    } else if (Buffer.isBuffer(file)) {
      data = file
    } else if (file instanceof Readable) {
      data = file
    } else if (typeof (file as any).getReader === 'function') {
      // Web ReadableStream
      // @ts-ignore - Node types might not be fully up to date with global ReadableStream
      data = Readable.fromWeb(file as any)
    } else {
      throw new Error("Invalid file type")
    }

    // Clean filename (remove special characters, keep only safe ones)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const path = `${folder}/${safeFileName}`
    const uploadUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${path}`

    // Estimate size for timeout if possible
    let fileSizeMB = 0
    if (Buffer.isBuffer(data)) {
      fileSizeMB = data.length / (1024 * 1024)
    }
    // If stream, we can't easily know size unless passed. We'll use a default generous timeout.

    const timeoutMinutes = fileSizeMB > 0 ? Math.max(10, Math.ceil(fileSizeMB / 50) + 10) : 60
    const timeoutMs = timeoutMinutes * 60 * 1000

    console.log(`[BunnyCDN] Uploading ${fileName} ${fileSizeMB > 0 ? `(${fileSizeMB.toFixed(2)}MB)` : '(stream)'} with ${timeoutMinutes}min timeout`)

    const startTime = Date.now()
    const response = await axios.put(uploadUrl, data, {
      headers: {
        AccessKey: BUNNYCDN_API_KEY,
        "Content-Type": getContentType(fileName),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: timeoutMs,
    })

    const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[BunnyCDN] Uploaded ${fileName} in ${uploadTime}s`)

    if (response.status === 201 || response.status === 200) {
      const cdnUrl = `${BUNNYCDN_PULL_ZONE}/${path}`
      return { success: true, url: cdnUrl }
    }

    return {
      success: false,
      error: `Upload failed with status ${response.status}`,
    }
  } catch (error) {
    console.error("BunnyCDN upload error:", error)
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: error.response?.data?.Message || error.message || "Upload failed",
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function uploadFilesInParallel(
  uploads: Array<{ file: File; fileName: string; folder: "images" | "downloads" }>
): Promise<Array<{ fileName: string; result: UploadResult }>> {
  const results = await Promise.allSettled(
    uploads.map(({ file, fileName, folder }) =>
      uploadToBunnyCDN(file, fileName, folder).then((result) => ({
        fileName,
        result,
      }))
    )
  )

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value
    } else {
      return {
        fileName: uploads[index].fileName,
        result: {
          success: false,
          error: result.reason?.message || "Upload failed",
        },
      }
    }
  })
}