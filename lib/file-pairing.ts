import type { FilePair } from "@/types"

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"]

function getBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1) return filename
  return filename.substring(0, lastDot)
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1) return ""
  return filename.substring(lastDot + 1).toLowerCase()
}

function isImageFile(filename: string): boolean {
  const ext = getExtension(filename)
  return IMAGE_EXTENSIONS.includes(ext)
}

export function pairFiles(files: File[]): {
  pairs: FilePair[]
  unmatched: File[]
  errors: string[]
} {
  const pairs: FilePair[] = []
  const unmatched: File[] = []
  const errors: string[] = []

  // Group files by base name
  const fileGroups = new Map<string, { images: File[]; downloads: File[] }>()

  for (const file of files) {
    const baseName = getBaseName(file.name)
    const ext = getExtension(file.name)

    if (!fileGroups.has(baseName)) {
      fileGroups.set(baseName, { images: [], downloads: [] })
    }

    const group = fileGroups.get(baseName)!

    if (isImageFile(file.name)) {
      group.images.push(file)
    } else {
      group.downloads.push(file)
    }
  }

  // Create pairs
  for (const [baseName, group] of fileGroups.entries()) {
    if (group.images.length === 0) {
      unmatched.push(...group.downloads)
      errors.push(`No image file found for "${baseName}"`)
      continue
    }

    if (group.downloads.length === 0) {
      unmatched.push(...group.images)
      errors.push(`No download file found for "${baseName}"`)
      continue
    }

    if (group.images.length > 1) {
      unmatched.push(...group.images, ...group.downloads)
      errors.push(`Multiple image files found for "${baseName}"`)
      continue
    }

    if (group.downloads.length > 1) {
      unmatched.push(...group.downloads, ...group.images)
      errors.push(`Multiple download files found for "${baseName}"`)
      continue
    }

    // Perfect pair!
    pairs.push({
      id: crypto.randomUUID(),
      baseName,
      imageFile: group.images[0],
      downloadFile: group.downloads[0],
    })
  }

  return { pairs, unmatched, errors }
}

export function validatePairs(pairs: FilePair[]): {
  valid: boolean
  error?: string
} {
  if (pairs.length === 0) {
    return { valid: false, error: "No file pairs found" }
  }

  if (pairs.length > 100) {
    return {
      valid: false,
      error: `Too many products. Maximum is 100, found ${pairs.length}`,
    }
  }

  return { valid: true }
}