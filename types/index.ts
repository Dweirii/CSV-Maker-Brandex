export interface FilePair {
    id: string
    baseName: string
    imageFile: File
    downloadFile: File
    imageUrl?: string
    downloadUrl?: string
  }
  
  export interface ProductData {
    name: string
    description: string
    price: string // "0.20"
    categoryId: string
    downloadUrl: string
    imageUrl: string[] // Array of image URLs
    keywords: string[]
    isFeatured: boolean
    isArchived: boolean
    status?: "success" | "failed" | "updated"
    error?: string
  }
  
  export interface UploadProgress {
    total: number
    completed: number
    failed: number
    current?: string // Current file being processed
  }
  
  export interface MetadataResult {
    name: string
    description: string
    keywords: string[]
  }
  
  export interface Category {
    id: string
    name: string
    storeId: string
  }