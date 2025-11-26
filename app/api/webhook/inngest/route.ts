import { NextRequest, NextResponse } from "next/server"
import { setJobResult } from "@/lib/job-store"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { jobId, status, csvContent, successful, failed, totalProducts, error } = body

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      )
    }

    // Store the result
    setJobResult(jobId, {
      status: status || "completed",
      csvContent,
      successful,
      failed,
      totalProducts,
      error,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    )
  }
}

