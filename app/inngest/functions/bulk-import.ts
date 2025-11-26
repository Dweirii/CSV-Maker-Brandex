import { inngest } from "@/lib/inngest"
import { uploadToBunnyCDN } from "@/lib/bunnycdn"
import type { FilePair, ProductData } from "@/types"

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
    { id: "bulk-import-products", name: "bulk Import Products" },
    { event: "bulk.import" },
    async ({ event, step }) => {
        const { pairs, categoryId, categoryName, jobId } = event.data

        const uploadResults = await step.run("upload-files", async () => {
            const uploads: Array<{
                fileName: string
                results: { success: boolean; url?: string; error?: string }
            }> = []

            for (const pair of pairs) {
                const imageBlob = new Blob([
                    Uint8Array.from(atob(pair.imageFile.data), (c) => c.charCodeAt(0)),
                ])
                const imageFile = new File ([imageBlob], pair.imageFile.name, {
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

                uploads.push(
                    {
                        fileName: imageFile.name,
                        results: imageResult    
                    },
                    {
                        fileName: downloadFile.name,
                        results: downloadResult,
                    }
                )
            }

            return uploads
        })

        return {
            jobId,
            status: "completed",
            uploaded: uploadResults.length,
        }
    }
)
