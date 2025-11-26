"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Category } from "@/types"

interface CategorySelectorProps {
  onCategoryChange: (category: Category | null) => void
}

export function CategorySelector({ onCategoryChange }: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch categories from Brandex Admin API or use hardcoded list
    const fetchCategories = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BRANDEX_ADMIN_API_URL || "https://admin.wibimax.com"
        const storeId = process.env.NEXT_PUBLIC_STORE_ID || "a940170f-71ea-4c2b-b0ec-e2e9e3c68567"
        
        const response = await fetch(`${apiUrl}/api/${storeId}/categories`)
        if (response.ok) {
          const data = await response.json()
          setCategories(data)
        } else {
          // Fallback to hardcoded categories
          setCategories([
            { id: "1364f5f9-6f45-48fd-8cd1-09815e1606c0", name: "PSD LAB", storeId: "" },
            { id: "6214c586-a7c7-4f71-98ab-e1bc147a07f4", name: "IMAGES", storeId: "" },
            { id: "960cb6f5-8dc1-48cf-900f-aa60dd8ac66a", name: "MOCKUP STUDIO", storeId: "" },
            { id: "b0469986-6cb9-4a35-8cd6-6cc9ec51a561", name: "VECTOR'S", storeId: "" },
            { id: "c302954a-6cd2-43a7-9916-16d9252f754c", name: "MOTION LIBRARY", storeId: "" },
            { id: "fd995552-baa8-4b86-bf7e-0acbefd43fd6", name: "PACKAGING", storeId: "" },
          ])
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error)
        // Fallback to hardcoded categories
        setCategories([
          { id: "1364f5f9-6f45-48fd-8cd1-09815e1606c0", name: "PSD LAB", storeId: "" },
          { id: "6214c586-a7c7-4f71-98ab-e1bc147a07f4", name: "IMAGES", storeId: "" },
          { id: "960cb6f5-8dc1-48cf-900f-aa60dd8ac66a", name: "MOCKUP STUDIO", storeId: "" },
          { id: "b0469986-6cb9-4a35-8cd6-6cc9ec51a561", name: "VECTOR'S", storeId: "" },
          { id: "c302954a-6cd2-43a7-9916-16d9252f754c", name: "MOTION LIBRARY", storeId: "" },
          { id: "fd995552-baa8-4b86-bf7e-0acbefd43fd6", name: "PACKAGING", storeId: "" },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [])

  const handleChange = (value: string) => {
    setSelectedCategory(value)
    const category = categories.find((c) => c.id === value) || null
    onCategoryChange(category)
  }

  if (loading) {
    return <div>Loading categories...</div>
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="category">Select Category</Label>
      <Select value={selectedCategory} onValueChange={handleChange}>
        <SelectTrigger id="category">
          <SelectValue placeholder="Choose a category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}