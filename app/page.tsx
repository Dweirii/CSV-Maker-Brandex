"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { FileUpload } from "@/components/file-upload"
import { CategorySelector } from "@/components/category-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Download, Loader2 } from "lucide-react"
import type { FilePair, Category } from "@/types"
import { downloadCSV } from "@/lib/csv-generator"

export default function Home() {
  const [pairs, setPairs] = useState<FilePair[]>([])
  const [category, setCategory] = useState<Category | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [csvContent, setCsvContent] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  // Upload file to BunnyCDN
  const uploadFile = async (file: File, folder: "images" | "downloads"): Promise<string> => {
    // Use streaming upload via raw body
    const filename = encodeURIComponent(file.name)
    const response = await fetch(`/api/upload?filename=${filename}&folder=${folder}`, {
      method: "POST",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Upload failed")
    }

    const data = await response.json()
    return data.url
  }

  const handleStartImport = async () => {
    if (pairs.length === 0) {
      toast.error("Please upload files first")
      return
    }

    if (!category) {
      toast.error("Please select a category")
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setCsvContent(null)

    try {
      // Step 1: Upload all files to BunnyCDN
      setProgress(5)
      toast.loading(`Uploading files to BunnyCDN (0/${pairs.length * 2})...`, { id: "uploading" })

      let completedUploads = 0
      const totalFiles = pairs.length * 2 // Each pair has 2 files

      const updateProgress = () => {
        completedUploads++
        const progress = 5 + Math.floor((completedUploads / totalFiles) * 45)
        setProgress(progress)
        toast.loading(
          `Uploading files to BunnyCDN (${completedUploads}/${totalFiles})...`,
          { id: "uploading" }
        )
      }

      const processedPairs: PromiseSettledResult<{
        id: string
        baseName: string
        imageFile: { name: string; url: string }
        downloadFile: { name: string; url: string }
      }>[] = []

      const BATCH_SIZE = 5

      for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
        const batch = pairs.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.allSettled(
          batch.map(async (pair) => {
            try {
              console.log(`Starting upload for pair: ${pair.baseName}`)

              const [imageUrl, downloadUrl] = await Promise.all([
                uploadFile(pair.imageFile, "images")
                  .then((url) => {
                    updateProgress()
                    return url
                  })
                  .catch((error) => {
                    console.error(`Image upload failed for ${pair.imageFile.name}:`, error)
                    throw new Error(`Image upload failed: ${error.message}`)
                  }),
                uploadFile(pair.downloadFile, "downloads")
                  .then((url) => {
                    updateProgress()
                    return url
                  })
                  .catch((error) => {
                    console.error(`Download upload failed for ${pair.downloadFile.name}:`, error)
                    throw new Error(`Download upload failed: ${error.message}`)
                  }),
              ])

              console.log(`Successfully uploaded pair: ${pair.baseName}`)

              return {
                id: pair.id,
                baseName: pair.baseName,
                imageFile: {
                  name: pair.imageFile.name,
                  url: imageUrl,
                },
                downloadFile: {
                  name: pair.downloadFile.name,
                  url: downloadUrl,
                },
              }
            } catch (error) {
              console.error(`Failed to upload pair ${pair.id}:`, error)
              throw error
            }
          })
        )

        processedPairs.push(...batchResults)
      }

      // Filter out failed uploads and show errors
      const successfulPairs = processedPairs
        .map((result, index) => {
          if (result.status === "fulfilled") {
            return result.value
          } else {
            toast.error(
              `Failed to upload ${pairs[index].baseName}: ${result.reason?.message || "Unknown error"}`,
              { duration: 5000 }
            )
            return null
          }
        })
        .filter((pair): pair is NonNullable<typeof pair> => pair !== null)

      if (successfulPairs.length === 0) {
        throw new Error("All file uploads failed")
      }

      if (successfulPairs.length < pairs.length) {
        toast.error(`${pairs.length - successfulPairs.length} product(s) failed to upload`, {
          duration: 5000,
        })
      }

      setProgress(50)
      toast.dismiss("uploading")
      toast.loading("Starting import job...", { id: "starting" })

      // Step 2: Send URLs to Inngest (small payload)
      const response = await fetch("/api/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: category.id,
          categoryName: category.name,
          pairs: successfulPairs,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to start import")
      }

      const data = await response.json()
      setJobId(data.jobId)
      setProgress(50)
      toast.dismiss("starting")
      toast.success("Import started! Processing in background...")

      // Set initial status
      await fetch(`/api/import/${data.jobId}`, {
        method: "POST", // We'll create a POST endpoint to set initial status
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "processing" }),
      }).catch(() => {
        // Ignore if endpoint doesn't exist yet
      })

      // Start polling for results
      pollForResults(data.jobId)

    } catch (error) {
      console.error("Import error:", error)
      toast.error(error instanceof Error ? error.message : "Import failed")
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const pollForResults = async (jobId: string) => {
    const maxAttempts = 120 // 10 minutes max (5 second intervals)
    let attempts = 0

    const poll = async () => {
      try {
        const response = await fetch(`/api/import/${jobId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.status === "completed") {
            setCsvContent(data.csvContent)
            setProgress(100)
            setIsProcessing(false)
            toast.success(`Import completed! ${data.successful} products processed.`)
            return
          } else if (data.status === "failed") {
            setIsProcessing(false)
            setProgress(0)
            toast.error("Import failed. Check Inngest dashboard for details.")
            return
          }
          // Still processing, update progress
          setProgress(50 + (attempts / maxAttempts) * 40) // 50% to 90%
        }
      } catch (error) {
        console.error("Polling error:", error)
      }

      attempts++
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000) // Poll every 5 seconds
      } else {
        setIsProcessing(false)
        toast.error("Import is taking longer than expected. Check Inngest dashboard.")
      }
    }

    poll()
  }

  const handleDownloadCSV = () => {
    if (csvContent) {
      downloadCSV(csvContent, `products-${Date.now()}.csv`)
      toast.success("CSV downloaded!")
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">CSV Products Maker</h1>
        <p className="text-muted-foreground">
          Upload product files, generate metadata, and export CSV for Brandex-Admin
        </p>
      </div>

      <CategorySelector onCategoryChange={setCategory} />

      <FileUpload onPairsChange={setPairs} onErrorsChange={setErrors} />

      {pairs.length > 0 && category && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Products: {pairs.length}</span>
                <span>Category: {category.name}</span>
              </div>
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleStartImport}
                disabled={isProcessing || pairs.length === 0 || !category}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Start Import"
                )}
              </Button>

              {csvContent && (
                <Button onClick={handleDownloadCSV} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
              )}
            </div>

            {errors.length > 0 && (
              <div className="text-sm text-destructive">
                <p className="font-medium">Warnings:</p>
                <ul className="list-disc list-inside">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {jobId && (
        <Card>
          <CardHeader>
            <CardTitle>Import Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Job ID: {jobId}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Your import is processing in the background. Check Inngest dashboard for progress.
              The CSV will be available when complete.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}