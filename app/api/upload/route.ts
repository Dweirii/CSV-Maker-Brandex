import { NextRequest, NextResponse } from "next/server"
import { uploadToBunnyCDN } from "@/lib/bunnycdn"

export const maxDuration = 900; // 15 minutes per file


export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file") as File
      const folder = (formData.get("folder") as string) || "images"

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        )
      }

      // Upload to BunnyCDN
      const result = await uploadToBunnyCDN(
        file,
        file.name,
        folder as "images" | "downloads"
      )

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Upload failed" },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        url: result.url,
        fileName: file.name,
      })
    } else {
      // Streaming upload
      const searchParams = req.nextUrl.searchParams
      const fileName = searchParams.get("filename")
      const folder = searchParams.get("folder") || "images"

      if (!fileName) {
        return NextResponse.json(
          { error: "Filename is required" },
          { status: 400 }
        )
      }

      if (!req.body) {
        return NextResponse.json(
          { error: "No file content provided" },
          { status: 400 }
        )
      }

      // Upload to BunnyCDN using stream
      const result = await uploadToBunnyCDN(
        req.body,
        fileName,
        folder as "images" | "downloads"
      )

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Upload failed" },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        url: result.url,
        fileName: fileName,
      })
    }
  } catch (error) {
    console.error("Upload API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    )
  }
}

