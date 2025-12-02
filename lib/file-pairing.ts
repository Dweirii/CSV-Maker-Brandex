import type { FilePair, Category } from "@/types"

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"]
const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "webm", "mkv", "m4v"]

// Categories that don't require pairing (single file per product, preview = download)
const SINGLE_FILE_CATEGORY_IDS = [
  "6214c586-a7c7-4f71-98ab-e1bc147a07f4", // IMAGES
  "c302954a-6cd2-43a7-9916-16d9252f754c", // MOTION LIBRARY
]

// File limits per category
const IMAGES_CATEGORY_ID = "6214c586-a7c7-4f71-98ab-e1bc147a07f4"
const IMAGES_MAX_FILES = 1000 // Higher limit for IMAGES category
const DEFAULT_MAX_FILES = 100 // Default limit for other categories

export function isSingleFileCategory(category: Category | null): boolean {
  if (!category) return false
  return SINGLE_FILE_CATEGORY_IDS.includes(category.id)
}

export function getMaxFilesForCategory(category: Category | null): number {
  if (!category) return DEFAULT_MAX_FILES
  if (category.id === IMAGES_CATEGORY_ID) return IMAGES_MAX_FILES
  return DEFAULT_MAX_FILES
}

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

function isVideoFile(filename: string): boolean {
  const ext = getExtension(filename)
  return VIDEO_EXTENSIONS.includes(ext)
}

function isMediaFile(filename: string): boolean {
  return isImageFile(filename) || isVideoFile(filename)
}

export function pairFiles(
  files: File[],
  category: Category | null = null
): {
  pairs: FilePair[]
  unmatched: File[]
  errors: string[]
} {
  const pairs: FilePair[] = []
  const unmatched: File[] = []
  const errors: string[] = []

  const isSingleFile = isSingleFileCategory(category)

  // For single-file categories, each file is its own product
  if (isSingleFile) {
    for (const file of files) {
      // Only accept image or video files for single-file categories
      if (!isMediaFile(file.name)) {
        unmatched.push(file)
        errors.push(`File "${file.name}" is not an image or video file`)
        continue
      }

      pairs.push({
        id: crypto.randomUUID(),
        baseName: getBaseName(file.name),
        imageFile: file,
        // downloadFile is undefined for single-file categories
      })
    }

    return { pairs, unmatched, errors }
  }

  // Original pairing logic for categories that need pairs
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

export function validatePairs(
  pairs: FilePair[],
  category: Category | null = null,
  unmatched: File[] = []
): {
  valid: boolean
  error?: string
} {
  if (pairs.length === 0) {
    return { valid: false, error: "No file pairs found" }
  }

  const maxFiles = getMaxFilesForCategory(category)
  if (pairs.length > maxFiles) {
    return {
      valid: false,
      error: `Too many products. Maximum is ${maxFiles}, found ${pairs.length}`,
    }
  }

  const isSingleFile = isSingleFileCategory(category)

  // For single-file categories: reject if there are unmatched files (only single files allowed)
  if (isSingleFile) {
    if (unmatched.length > 0) {
      return {
        valid: false,
        error: `This category only accepts single image or video files. ${unmatched.length} file(s) were rejected.`,
      }
    }
    // Validate that all pairs have no downloadFile
    const invalidPairs = pairs.filter((p) => p.downloadFile !== undefined)
    if (invalidPairs.length > 0) {
      return {
        valid: false,
        error: "Single-file category should not have download files",
      }
    }
  } else {
    // For paired categories: reject if there are unmatched files (all files must be paired)
    if (unmatched.length > 0) {
      return {
        valid: false,
        error: `This category requires paired files (image + download). ${unmatched.length} file(s) could not be paired and were rejected.`,
      }
    }
    // Validate that all pairs have downloadFile
    const invalidPairs = pairs.filter((p) => !p.downloadFile)
    if (invalidPairs.length > 0) {
      return {
        valid: false,
        error: "All products must have both image and download files",
      }
    }
  }

  return { valid: true }
}