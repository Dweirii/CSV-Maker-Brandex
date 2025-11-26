"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { UploadCloud, X, CheckCircle, AlertCircle } from "lucide-react"
import { pairFiles, validatePairs } from "@/lib/file-pairing"
import type { FilePair } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface FileUploadProps {
  onPairsChange: (pairs: FilePair[]) => void
  onErrorsChange: (errors: string[]) => void
}

export function FileUpload({ onPairsChange, onErrorsChange }: FileUploadProps) {
  const [pairs, setPairs] = useState<FilePair[]>([])
  const [unmatched, setUnmatched] = useState<File[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Pair files instantly
      const { pairs: newPairs, unmatched: newUnmatched, errors: newErrors } =
        pairFiles(acceptedFiles)

      // Validate pairs
      const validation = validatePairs(newPairs)

      if (!validation.valid) {
        setErrors([validation.error || "Validation failed", ...newErrors])
        onErrorsChange([validation.error || "Validation failed", ...newErrors])
      } else {
        setErrors(newErrors)
        onErrorsChange(newErrors)
      }

      setPairs(newPairs)
      setUnmatched(newUnmatched)
      onPairsChange(newPairs)
    },
    [onPairsChange, onErrorsChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
      "application/*": [".psd", ".zip", ".rar", ".pdf"],
    },
    maxFiles: 200, // 100 products = 200 files
  })

  const removePair = (pairId: string) => {
    const newPairs = pairs.filter((p) => p.id !== pairId)
    setPairs(newPairs)
    onPairsChange(newPairs)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Product Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={`
            flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg 
            transition-all cursor-pointer
            ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary"
            }
          `}
        >
          <input {...getInputProps()} />
          <UploadCloud className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">
            {isDragActive ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Or click to browse (Max 100 products = 200 files)
          </p>
        </div>

        {pairs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {pairs.length} product{pairs.length !== 1 ? "s" : ""} paired
              </p>
              <Badge variant="secondary">{pairs.length}/100</Badge>
            </div>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {errors.map((error, i) => (
                      <li key={i} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-60 overflow-y-auto space-y-2">
              {pairs.map((pair) => (
                <div
                  key={pair.id}
                  className="flex items-center justify-between p-2 bg-muted rounded"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{pair.baseName}</p>
                    <p className="text-xs text-muted-foreground">
                      {pair.imageFile.name} + {pair.downloadFile.name}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePair(pair.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}