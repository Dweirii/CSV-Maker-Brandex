// Simple in-memory store for job results
// In production, use Redis or a database

interface JobResult {
  status: "processing" | "completed" | "failed"
  csvContent?: string
  successful?: number
  failed?: number
  totalProducts?: number
  error?: string
}

interface JobInput {
  pairs: Array<{
    id: string
    baseName: string
    imageFile: {
      name: string
      url: string
    }
    downloadFile: {
      name: string
      url: string
    }
  }>
  categoryId: string
  categoryName: string
}

const jobResults = new Map<string, JobResult>()
const jobInputs = new Map<string, JobInput>()

export function getJobResult(jobId: string): JobResult | undefined {
  return jobResults.get(jobId)
}

export function setJobResult(jobId: string, result: JobResult): void {
  jobResults.set(jobId, result)
}

export function deleteJobResult(jobId: string): void {
  jobResults.delete(jobId)
}

// Functions for storing/retrieving job input data (to avoid large event payloads)
export function setJobInput(jobId: string, input: JobInput): void {
  jobInputs.set(jobId, input)
}

export function getJobInput(jobId: string): JobInput | undefined {
  return jobInputs.get(jobId)
}

export function deleteJobInput(jobId: string): void {
  jobInputs.delete(jobId)
}

