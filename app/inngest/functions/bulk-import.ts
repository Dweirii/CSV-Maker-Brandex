import { inngest } from "@/lib/inngest"
import { generateProductMetadata } from "@/lib/openai"
import { generateCSV } from "@/lib/csv-generator"
import type { ProductData } from "@/types"
import { mapWithConcurrency } from "@/lib/concurrency"

interface BulkImportEvent {
  name: "bulk.import"
  data: {
    jobId: string
    pairs: Array<{
      id: string
      baseName: string
      imageFile: {
        name: string
        url: string
      }
      downloadFile: {
        name: string
        url: string
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

    // Files are already uploaded, we just use the URLs
    const uploadResults = await step.run("validate-urls", async () => {
      return pairs.map((pair: typeof pairs[number]) => ({
        pairId: pair.id,
        imageUrl: pair.imageFile.url,
        downloadUrl: pair.downloadFile.url,
        errors: [] as string[],
      }))
    })

    const products = await step.run("generate-metadata", async () => {
      // Process with high concurrency using pool
      const results = await mapWithConcurrency(
        pairs,
        20, // High concurrency for gpt-4o-mini
        async (pair: typeof pairs[number], index: number) => {
          const upload = uploadResults[index]

          if (upload.errors.length > 0 || !upload.imageUrl || !upload.downloadUrl) {
            return {
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
              error: upload.errors.join("; ") || "Missing URLs",
            } as ProductData
          }

          try {
            // Generate metadata using the image URL
            const metadata = await generateProductMetadata(
              upload.imageUrl,
              pair.downloadFile.name,
              categoryName
            )

            return {
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
            } as ProductData
          } catch (error) {
            return {
              name: pair.baseName,
              description: "",
              price: "0.20",
              categoryId,
              downloadUrl: upload.downloadUrl,
              imageUrl: [upload.imageUrl],
              keywords: [],
              isFeatured: false,
              isArchived: false,
              status: "failed",
              error: error instanceof Error ? error.message : "Metadata generation failed",
            } as ProductData
          }
        }
      )

      // Extract values from settled results (mapWithConcurrency returns PromiseSettledResult[])
      return results.map((r: PromiseSettledResult<ProductData>) => r.status === 'fulfilled' ? r.value : {
        name: "Unknown",
        description: "",
        price: "0.20",
        categoryId,
        downloadUrl: "",
        imageUrl: [],
        keywords: [],
        isFeatured: false,
        isArchived: false,
        status: "failed",
        error: r.reason instanceof Error ? r.reason.message : "Unknown error"
      } as ProductData)
    })

    const csvContent = await step.run("generate-csv", async () => {
      return generateCSV(products)
    })

    const result = {
      jobId,
      status: "completed" as const,
      totalProducts: products.length,
      successful: products.filter((p: ProductData) => p.status === "success").length,
      failed: products.filter((p: ProductData) => p.status === "failed").length,
      csvContent,
    }

    // Send results to webhook
    await step.run("send-webhook", async () => {
      try {
        // Use environment variable or default to localhost for dev
        const baseUrl = process.env.APP_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000"

        const webhookUrl = `${baseUrl}/api/webhook/inngest`

        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(result),
        })

        if (!response.ok) {
          console.error("Webhook response not OK:", await response.text())
        }
      } catch (error) {
        console.error("Failed to send webhook:", error)
        // Don't fail the job if webhook fails
      }
    })

    return result
  }
)