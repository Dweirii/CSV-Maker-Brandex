"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { FileUpload } from "@/components/file-upload"
import { CategorySelector } from "@/components/category-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Download, Loader2, CheckCircle } from "lucide-react"
import type { FilePair, Category } from "@/types"
import { downloadCSV } from "@/lib/csv-generator"
import { mapWithConcurrency } from "@/lib/concurrency"
import { isSingleFileCategory } from "@/lib/file-pairing"

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

  // Upload file with retry logic for resilience
  const uploadFileWithRetry = async (
    file: File,
    folder: "images" | "downloads",
    retries = 2
  ): Promise<string> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await uploadFile(file, folder)
      } catch (error) {
        if (attempt === retries) {
          throw error // Last attempt failed, throw the error
        }
        // Exponential backoff: wait 1s, 2s, 4s...
        const delay = 1000 * Math.pow(2, attempt)
        console.log(
          `Upload attempt ${attempt + 1} failed for ${file.name}, retrying in ${delay}ms...`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
    throw new Error("Upload failed after retries")
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
      const isSingleFile = isSingleFileCategory(category)
      const totalFiles = isSingleFile ? pairs.length : pairs.length * 2 // Single file per product or 2 files per pair
      
      setProgress(5)
      toast.loading(`Uploading files to BunnyCDN (0/${totalFiles})...`, { id: "uploading" })

      let completedUploads = 0

      const updateProgress = () => {
        completedUploads++
        const progress = 5 + Math.floor((completedUploads / totalFiles) * 45)
        setProgress(progress)
        toast.loading(
          `Uploading files to BunnyCDN (${completedUploads}/${totalFiles})...`,
          { id: "uploading" }
        )
      }

      const concurrencyLimit = (() => {
        if (isSingleFile && category?.name === "IMAGES") {
          return 25 
        } else if (isSingleFile) {
          return 15
        } else {
          return 8 
        }
      })()

      // Upload with concurrency pool
      const processedPairs = await mapWithConcurrency(
        pairs,
        concurrencyLimit, // Dynamic concurrency
        async (pair: FilePair) => {
          try {
            console.log(`Starting upload for pair: ${pair.baseName}`)

            if (isSingleFile) {
              // For single-file categories, upload once and use same URL for both preview and download
              const fileUrl = await uploadFileWithRetry(pair.imageFile, "images")
                .then((url) => {
                  updateProgress()
                  return url
                })
                .catch((error) => {
                  console.error(`File upload failed for ${pair.imageFile.name}:`, error)
                  throw new Error(`File upload failed: ${error.message}`)
                })

              console.log(`Successfully uploaded file: ${pair.baseName}`)

              return {
                id: pair.id,
                baseName: pair.baseName,
                imageFile: {
                  name: pair.imageFile.name,
                  url: fileUrl,
                },
                downloadFile: {
                  name: pair.imageFile.name,
                  url: fileUrl, // Same URL for preview and download
                },
              }
            } else {
              // Original logic for paired categories
              if (!pair.downloadFile) {
                throw new Error("Download file is required for paired categories")
              }

              const [imageUrl, downloadUrl] = await Promise.all([
                uploadFileWithRetry(pair.imageFile, "images")
                  .then((url) => {
                    updateProgress()
                    return url
                  })
                  .catch((error) => {
                    console.error(`Image upload failed for ${pair.imageFile.name}:`, error)
                    throw new Error(`Image upload failed: ${error.message}`)
                  }),
                uploadFileWithRetry(pair.downloadFile, "downloads")
                  .then((url) => {
                    updateProgress()
                    return url
                  })
                  .catch((error) => {
                    console.error(`Download upload failed for ${pair.downloadFile!.name}:`, error)
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
            }
          } catch (error) {
            console.error(`Failed to upload pair ${pair.id}:`, error)
            throw error
          }
        }
      )

      // Filter out failed uploads and show errors
      const successfulPairs = processedPairs
        .map((result: PromiseSettledResult<any>, index: number) => {
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
        .filter((pair: any): pair is NonNullable<typeof pair> => pair !== null)

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
    <div className="container mx-auto p-6 max-w-5xl space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          CSV Products Maker
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Streamline your product import process. Upload files, pair them automatically, and generate CSVs for Brandex-Admin.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_350px] items-start">
        <div className="space-y-8">
          <FileUpload onPairsChange={setPairs} onErrorsChange={setErrors} category={category} />
        </div>

        <div className="space-y-6 sticky top-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <CategorySelector onCategoryChange={setCategory} />
            </CardContent>
          </Card>

          {pairs.length > 0 && category && (
            <Card className="border-primary/20 shadow-lg">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CheckCircle className="h-5 w-5" />
                  Ready to Import
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Products</span>
                    <span className="font-bold text-lg">{pairs.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{category.name}</span>
                  </div>

                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-primary">Processing...</span>
                        <span className="text-muted-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleStartImport}
                    disabled={isProcessing || pairs.length === 0 || !category}
                    className="w-full h-12 text-lg font-semibold shadow-md transition-all hover:scale-[1.02]"
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Start Import"
                    )}
                  </Button>

                  {csvContent && (
                    <Button onClick={handleDownloadCSV} variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {jobId && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Import Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job ID:</span>
                    <span className="font-mono text-xs">{jobId.slice(0, 8)}...</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Your import is processing in the background. Check Inngest dashboard for progress.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}