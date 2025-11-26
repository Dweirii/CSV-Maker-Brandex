import OpenAI from "openai"
import type { MetadataResult } from "@/types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/**
 * Generate product metadata using OpenAI GPT-4
 */
export async function generateProductMetadata(
  imageUrl: string,
  downloadFileName: string,
  categoryName: string
): Promise<MetadataResult> {
  try {
    const prompt = `You are an expert e-commerce product description writer. Generate SEO-friendly product metadata for a digital product.

Product Details:
- Download File: ${downloadFileName}
- Category: ${categoryName}
- Image URL: ${imageUrl}

Generate:
1. A compelling product name (max 80 characters, no special characters except - and _)
2. A detailed product description (150-300 words, SEO-optimized)
3. 5-10 relevant keywords (comma-separated, related to the product and category)

Return ONLY a valid JSON object in this exact format:
{
  "name": "Product Name Here",
  "description": "Detailed description here...",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Do not include any markdown formatting or code blocks. Just the raw JSON.`

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional e-commerce product description writer. Always return valid JSON only, no markdown or code blocks.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    // Parse JSON response
    const parsed = JSON.parse(content) as {
      name: string
      description: string
      keywords: string | string[]
    }

    // Normalize keywords to array
    const keywords =
      typeof parsed.keywords === "string"
        ? parsed.keywords.split(",").map((k) => k.trim())
        : Array.isArray(parsed.keywords)
          ? parsed.keywords
          : []

    return {
      name: parsed.name.trim(),
      description: parsed.description.trim(),
      keywords: keywords.filter(Boolean),
    }
  } catch (error) {
    console.error("OpenAI metadata generation error:", error)

    // Fallback: Generate basic metadata from filename
    const baseName = downloadFileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())

    return {
      name: baseName || "Product",
      description: `High-quality ${categoryName.toLowerCase()} product: ${downloadFileName}`,
      keywords: [
        categoryName.toLowerCase(),
        ...downloadFileName
          .replace(/\.[^/.]+$/, "")
          .split(/[-_]/)
          .filter(Boolean)
          .slice(0, 5),
      ],
    }
  }
}

/**
 * Generate metadata for multiple products in batch
 */
export async function generateMetadataBatch(
  items: Array<{
    imageUrl: string
    downloadFileName: string
    categoryName: string
  }>
): Promise<Array<{ index: number; result: MetadataResult; error?: string }>> {
  const results = await Promise.allSettled(
    items.map((item, index) =>
      generateProductMetadata(
        item.imageUrl,
        item.downloadFileName,
        item.categoryName
      ).then((result) => ({ index, result }))
    )
  )

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value
    } else {
      return {
        index,
        result: {
          name: items[index].downloadFileName.replace(/\.[^/.]+$/, ""),
          description: `Product: ${items[index].downloadFileName}`,
          keywords: [items[index].categoryName.toLowerCase()],
        },
        error: result.reason?.message || "Metadata generation failed",
      }
    }
  })
}