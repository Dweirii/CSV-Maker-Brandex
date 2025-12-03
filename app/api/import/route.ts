import { NextRequest, NextResponse } from "next/server"
import { inngest } from "@/lib/inngest"
import { setJobInput } from "@/lib/job-store"

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

    // Store the pairs data in job store to avoid large event payload
    // Inngest has a size limit (~256KB), so we store data separately
    setJobInput(jobId, {
      pairs,
      categoryId,
      categoryName,
    })

    // Send only the jobId in the event (much smaller payload)
    await inngest.send({
      name: "bulk.import",
      data: {
        jobId, // Only send the job ID, not the entire pairs array
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