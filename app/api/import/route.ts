import { NextRequest, NextResponse } from "next/server"
import { inngest } from "@/lib/inngest"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { categoryId, categoryName, pairs } = body

    if (!categoryId || !categoryName || !pairs || !Array.isArray(pairs)) {
      return NextResponse.json(
        { error: "Missing required fields: categoryId, categoryName, or pairs" },
        { status: 400 }
      )
    }

    const jobId = crypto.randomUUID()

    await inngest.send({
      name: "bulk.import",
      data: {
        jobId,
        pairs, // Already uploaded to BunnyCDN, contains URLs
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