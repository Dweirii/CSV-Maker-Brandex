import Papa from "papaparse"
import type { ProductData } from "@/types"


export function generateCSV(products: ProductData[]): string {
  // Convert products to CSV rows matching Brandex-Admin schema
  const csvRows = products.map((product) => ({
    name: product.name,
    description: product.description || "",
    price: product.price, // "0.20"
    categoryId: product.categoryId,
    downloadUrl: product.downloadUrl || "",
    imageUrl: Array.isArray(product.imageUrl)
      ? product.imageUrl.join(",")
      : product.imageUrl || "",
    keywords: Array.isArray(product.keywords)
      ? product.keywords.join(",")
      : product.keywords || "",
    isFeatured: product.isFeatured ? "true" : "false",
    isArchived: product.isArchived ? "true" : "false",
    status: product.status || "success", 
    error: product.error || "",
  }))

  const csv = Papa.unparse(csvRows, {
    header: true,
    skipEmptyLines: false,
  })

  return csv
}

export function downloadCSV(csvContent: string, filename: string = "products.csv"): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}