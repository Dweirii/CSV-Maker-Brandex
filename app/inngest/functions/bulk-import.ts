import { inngest } from "@/lib/inngest"
import { uploadToBunnyCDN } from "@/lib/bunnycdn"
import { generateProductMetadata } from "@/lib/openai"
import { generateCSV } from "@/lib/csv-generator"
import type { ProductData } from "@/types"

interface BulkImportEvent {
  name: "bulk.import"
  data: {
    jobId: string
    pairs: Array<{
      id: string
      baseName: string
      imageFile: {
        name: string
        size: number
        type: string
        data: string
      }
      downloadFile: {
        name: string
        size: number
        type: string
        data: string
      }
    }>
    categoryId: string
    categoryName: string
  }
}

export const bulkImportProducts = inngest.createFunction(
  { id: "bulk-import-products", name: "Bulk Import Products" },
  { event: "bulk.import" },
  async ({ event, step }) => {
    const { pairs, categoryId, categoryName, jobId } = event.data

    const uploadResults = await step.run("upload-files", async () => {
      const results: Array<{
        pairId: string
        imageUrl?: string
        downloadUrl?: string
        errors: string[]
      }> = []

      for (const pair of pairs) {
        const errors: string[] = []

        const imageBlob = new Blob([
          Uint8Array.from(atob(pair.imageFile.data), (c) => c.charCodeAt(0)),
        ])
        const imageFile = new File([imageBlob], pair.imageFile.name, {
          type: pair.imageFile.type,
        })

        const downloadBlob = new Blob([
          Uint8Array.from(
            atob(pair.downloadFile.data),
            (c) => c.charCodeAt(0)
          ),
        ])
        const downloadFile = new File([downloadBlob], pair.downloadFile.name, {
          type: pair.downloadFile.type,
        })

        const imageResult = await uploadToBunnyCDN(
          imageFile,
          imageFile.name,
          "images"
        )

        const downloadResult = await uploadToBunnyCDN(
          downloadFile,
          downloadFile.name,
          "downloads"
        )

        if (!imageResult.success) {
          errors.push(`Image upload failed: ${imageResult.error}`)
        }
        if (!downloadResult.success) {
          errors.push(`Download upload failed: ${downloadResult.error}`)
        }

        results.push({
          pairId: pair.id,
          imageUrl: imageResult.url,
          downloadUrl: downloadResult.url,
          errors,
        })
      }

      return results
    })

    const products = await step.run("generate-metadata", async () => {
      const productData: ProductData[] = []

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i]
        const upload = uploadResults[i]

        if (upload.errors.length > 0 || !upload.imageUrl || !upload.downloadUrl) {
          productData.push({
            name: pair.baseName,
            description: "",
            price: "0.20",
            categoryId,
            downloadUrl: upload.downloadUrl || "",
            imageUrl: upload.imageUrl ? [upload.imageUrl] : [],
            keywords: [],
            isFeatured: false,
            isArchived: false,
            status: "failed",
            error: upload.errors.join("; "),
          })
          continue
        }

        const metadata = await generateProductMetadata(
          upload.imageUrl,
          pair.downloadFile.name,
          categoryName
        )

        productData.push({
          name: metadata.name,
          description: metadata.description,
          price: "0.20",
          categoryId,
          downloadUrl: upload.downloadUrl,
          imageUrl: [upload.imageUrl],
          keywords: metadata.keywords,
          isFeatured: false,
          isArchived: false,
          status: "success",
        })
      }

      return productData
    })

    const csvContent = await step.run("generate-csv", async () => {
      return generateCSV(products)
    })

    return {
      jobId,
      status: "completed",
      totalProducts: products.length,
      successful: products.filter((p) => p.status === "success").length,
      failed: products.filter((p) => p.status === "failed").length,
      csvContent,
    }
  }
)