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
import { GoogleDrivePicker } from "@/components/GoogleDrivePicker"

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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Product Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          {...getRootProps()}
          className={`
            flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl 
            transition-all duration-200 cursor-pointer
            ${isDragActive
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50"
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <UploadCloud className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-semibold">
            {isDragActive ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
            Upload pairs of images and download files.
            <br />
            (Max 100 products = 200 files)
          </p>
        </div>

        {/* Google Drive Alternative */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <GoogleDrivePicker
          onFilesSelected={(files) => {
            // Process Google Drive files same as local uploads
            const { pairs: newPairs, unmatched: newUnmatched, errors: newErrors } =
              pairFiles(files)

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
          }}
          disabled={false}
        />

        {/* Critical Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-1">Validation Errors</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Unmatched Files Warning */}
        {unmatched.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-300">
              <p className="font-semibold mb-1">Unmatched Files ({unmatched.length})</p>
              <p className="text-sm mb-2">
                The following files could not be paired and will be ignored:
              </p>
              <div className="max-h-32 overflow-y-auto pr-2">
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {unmatched.map((file, i) => (
                    <li key={i} className="break-all">{file.name}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Valid Pairs */}
        {pairs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Ready for Import
              </h3>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {pairs.length} / 100 Pairs
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
              {pairs.map((pair) => (
                <div
                  key={pair.id}
                  className="group relative flex flex-col p-3 bg-card border rounded-lg shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium truncate pr-6" title={pair.baseName}>
                      {pair.baseName}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => removePair(pair.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider">IMG</span>
                      <span className="truncate">{pair.imageFile.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                      <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider">FILE</span>
                      <span className="truncate">{pair.downloadFile.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}