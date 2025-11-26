import { NextRequest, NextResponse } from "next/server"
import { getJobResult, setJobResult } from "@/lib/job-store"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const result = getJobResult(jobId)

    if (!result) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Status API error:", error)
    return NextResponse.json(
      { error: "Failed to get job status" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const body = await req.json()
    
    setJobResult(jobId, {
      status: body.status || "processing",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Set status error:", error)
    return NextResponse.json(
      { error: "Failed to set job status" },
      { status: 500 }
    )
  }
}

