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

export async function uploadToBunnyCDN(
  file: File | Buffer,
  fileName: string,
  folder: "images" | "downloads" = "images"
): Promise<UploadResult> {
  try {
    let fileBuffer: Buffer
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
    } else {
      fileBuffer = file
    }

    // Clean filename (remove special characters, keep only safe ones)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const path = `${folder}/${safeFileName}`
    const uploadUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${path}`

    const fileSizeMB = fileBuffer.length / (1024 * 1024)
    const timeoutMinutes = Math.max(5, Math.ceil(fileSizeMB / 100) + 5)
    const timeoutMs = timeoutMinutes * 60 * 1000

    const response = await axios.put(uploadUrl, fileBuffer, {
      headers: {
        AccessKey: BUNNYCDN_API_KEY,
        "Content-Type": getContentType(fileName),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: timeoutMs, // 60 seconds timeout
    })

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