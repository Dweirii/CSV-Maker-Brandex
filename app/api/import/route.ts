import { NextRequest, NextResponse } from "next/server"
import { inngest } from "@/lib/inngest"


async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return buffer.toString("base64")
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const categoryId = formData.get("categoryId") as string
    const categoryName = formData.get("categoryName") as string
    const pairsJson = formData.get("pairs") as string

    if (!categoryId || !categoryName || !pairsJson) {
      return NextResponse.json(
        { error: "Missing required fields: categoryId, categoryName, or pairs" },
        { status: 400 }
      )
    }

    const pairs = JSON.parse(pairsJson)

    const processedPairs = await Promise.all(
      pairs.map(async (pair: { id: string; baseName: string; imageFile: File; downloadFile: File }) => {
        const [imageData, downloadData] = await Promise.all([
          fileToBase64(pair.imageFile),
          fileToBase64(pair.downloadFile),
        ])

        return {
          id: pair.id,
          baseName: pair.baseName,
          imageFile: {
            name: pair.imageFile.name,
            size: pair.imageFile.size,
            type: pair.imageFile.type,
            data: imageData,
          },
          downloadFile: {
            name: pair.downloadFile.name,
            size: pair.downloadFile.size,
            type: pair.downloadFile.type,
            data: downloadData,
          },
        }
      })
    )

    const jobId = crypto.randomUUID()

    await inngest.send({
      name: "bulk.import",
      data: {
        jobId,
        pairs: processedPairs,
        categoryId,
        categoryName,
      },
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: "Import job started",
    })
  } catch (error) {
    console.error("Import API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start import",
      },
      { status: 500 }
    )
  }
}