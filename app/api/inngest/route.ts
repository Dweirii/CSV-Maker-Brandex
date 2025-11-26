import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest"
import { bulkImportProducts } from "@/app/inngest/functions/bulk-import"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [bulkImportProducts],
})