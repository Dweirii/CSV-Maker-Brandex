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

const jobResults = new Map<string, JobResult>()

export function getJobResult(jobId: string): JobResult | undefined {
  return jobResults.get(jobId)
}

export function setJobResult(jobId: string, result: JobResult): void {
  jobResults.set(jobId, result)
}

export function deleteJobResult(jobId: string): void {
  jobResults.delete(jobId)
}

