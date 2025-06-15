"use client"

import { useMemo, useEffect, useRef, useState } from "react"
import { imageStorage } from "@/lib/image-storage"
import { Logger } from "@/lib/dev";

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const renderedContent = useMemo(() => {
    return parseMarkdown(content)
  }, [content])

  // Load blob URLs for images after rendering
  useEffect(() => {
    const loadBlobImages = async () => {
      if (!containerRef.current) return

      const imageElements = containerRef.current.querySelectorAll("img[data-blob-id]")
      console.log(`Found ${imageElements.length} blob images to load`)

      for (const imgElement of Array.from(imageElements)) {
        const img = imgElement as HTMLImageElement
        const blobId = img.getAttribute("data-blob-id")

        if (!blobId) continue

        // Skip if already processed
        if (loadedImages.has(blobId) || failedImages.has(blobId) || loadingImages.has(blobId)) {
          continue
        }

        console.log(`Loading blob image: ${blobId}`)
        setLoadingImages((prev) => new Set(prev).add(blobId))

        try {
          // Add loading state
          img.classList.add("loading-image")
          img.style.opacity = "0.5"

          const blobUrl = await imageStorage.createBlobUrl(blobId)

          if (blobUrl) {
            console.log(`Created blob URL for ${blobId}: ${blobUrl}`)

            // Create a new image to test loading
            const testImg = new Image()
            testImg.crossOrigin = "anonymous"

            // fixme：DOM updated is not work on the the page
            testImg.onload = () => {
              console.log(`Blob image loaded successfully: ${blobId}`)
              img.src = blobUrl
              img.classList.remove("loading-image")
              img.style.opacity = "1"
              Logger.info(img)
              setLoadedImages((prev) => new Set(prev).add(blobId))
              setLoadingImages((prev) => {
                const newSet = new Set(prev)
                newSet.delete(blobId)
                return newSet
              })
            }

            testImg.onerror = (error) => {
              console.error(`Failed to load blob image ${blobId}:`, error)
              img.alt = `Failed to load image: ${blobId}`
              img.classList.add("error-image")
              img.classList.remove("loading-image")
              img.style.opacity = "1"
              setFailedImages((prev) => new Set(prev).add(blobId))
              setLoadingImages((prev) => {
                const newSet = new Set(prev)
                newSet.delete(blobId)
                return newSet
              })
            }

            // Start loading the test image
            testImg.src = blobUrl
          } else {
            console.warn(`No blob URL created for image: ${blobId}`)
            img.alt = `Image not found (ID: ${blobId})`
            img.classList.add("error-image")
            img.classList.remove("loading-image")
            img.style.opacity = "1"
            setFailedImages((prev) => new Set(prev).add(blobId))
            setLoadingImages((prev) => {
              const newSet = new Set(prev)
              newSet.delete(blobId)
              return newSet
            })
          }
        } catch (error) {
          console.error(`Failed to load blob image ${blobId}:`, error)
          img.alt = `Error loading image: ${blobId}`
          img.classList.add("error-image")
          img.classList.remove("loading-image")
          img.style.opacity = "1"
          setFailedImages((prev) => new Set(prev).add(blobId))
          setLoadingImages((prev) => {
            const newSet = new Set(prev)
            newSet.delete(blobId)
            return newSet
          })
        }
      }
    }

    // Load images after a short delay to ensure DOM is ready
    const timer = setTimeout(loadBlobImages, 100)
    return () => clearTimeout(timer)
  }, [renderedContent, loadedImages, failedImages, loadingImages])

  // Cleanup blob URLs when component unmounts or content changes
  useEffect(() => {
    return () => {
      // Extract image IDs from current content and revoke unused blob URLs
      const currentImageIds = imageStorage.extractImageIds(content)
      const currentSet = new Set(currentImageIds)

      for (const loadedId of loadedImages) {
        if (!currentSet.has(loadedId)) {
          imageStorage.revokeBlobUrl(loadedId)
          setLoadedImages((prev) => {
            const newSet = new Set(prev)
            newSet.delete(loadedId)
            return newSet
          })
        }
      }
    }
  }, [content, loadedImages])

  return (
    <div
      ref={containerRef}
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}

function parseMarkdown(markdown: string): string {
  let html = markdown

  // Escape HTML to prevent XSS
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

  // Headers (must be processed before other formatting)
  html = html.replace(/^##### (.*$)/gm, '<h5 class="text-sm font-semibold text-theme-text mt-4 mb-2">$1</h5>')
  html = html.replace(/^#### (.*$)/gm, '<h4 class="text-base font-semibold text-theme-text mt-4 mb-2">$1</h4>')
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-theme-text mt-4 mb-2">$1</h3>')
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-theme-text mt-6 mb-3">$1</h2>')
  html = html.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-theme-text mt-6 mb-4">$1</h1>')

  // Code blocks (must be processed before inline code)
  html = html.replace(
    /```([\s\S]*?)```/g,
    '<pre class="bg-theme-card-accent border border-theme-border rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm text-theme-text font-mono">$1</code></pre>',
  )

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-theme-card-accent text-theme-text px-1.5 py-0.5 rounded text-sm font-mono">$1</code>',
  )

  // Bold text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-theme-text">$1</strong>')

  // Italic text
  html = html.replace(/\*(.*?)\*/g, '<em class="italic text-theme-text">$1</em>')

  // Underline text
  html = html.replace(/<u>(.*?)<\/u>/g, '<u class="underline text-theme-text">$1</u>')

  // Strikethrough text
  html = html.replace(/~~(.*?)~~/g, '<del class="line-through text-theme-text-muted">$1</del>')

  // Blockquotes
  html = html.replace(
    /^> (.*$)/gm,
    '<blockquote class="border-l-4 border-theme-primary pl-4 py-2 my-4 bg-theme-card-accent italic text-theme-text-muted">$1</blockquote>',
  )

  // Line breaks
  html = html.replace(/\n/g, "<br>")

  // Images - handle both regular markdown images and our blob images
  html = html.replace( /!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    console.log(`Processing image: alt="${alt}", src="${src}"`)

    // Check if this is a blob image ID
    if (src.startsWith("blob:")) {
      const imageId = src.replace("blob:", "")
      console.log(`Found blob image: ${imageId}`)

      // Create a placeholder image with the blob ID
      return `<img 
        src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjZjNmNGY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjUwIiByPSIyMCIgZmlsbD0iIzljYTNhZiIvPgo8dGV4dCB4PSIxMDAiIHk9IjU1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjM3MzgwIiBmb250LXNpemU9IjEyIj5Mb2FkaW5nLi4uPC90ZXh0Pgo8L3N2Zz4=" 
        alt="加载中..." 
        data-blob-id="${imageId}" 
        class="max-w-full h-auto rounded-lg border border-theme-border my-4 loading-image" 
        loading="lazy" 
        style="opacity: 0.5; min-height: 100px; background-color: rgb(var(--theme-card-accent));" />`
    }

    // Regular image
    return `<img src="${src}" alt="${alt}" class="max-w-full h-auto rounded-lg border border-theme-border my-4" loading="lazy" />`
  })

  // Paragraphs (group consecutive lines that aren't already wrapped in tags)
  const lines = html.split("<br>")
  const processedLines = []
  let currentParagraph = []

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Check if line is already wrapped in a block element
    if (trimmedLine.match(/^<(h[1-5]|pre|blockquote|div|img)/)) {
      // Finish current paragraph if exists
      if (currentParagraph.length > 0) {
        processedLines.push(`<p class="text-theme-text leading-relaxed my-2">${currentParagraph.join("<br>")}</p>`)
        currentParagraph = []
      }
      processedLines.push(trimmedLine)
    } else if (trimmedLine === "") {
      // Empty line - finish current paragraph
      if (currentParagraph.length > 0) {
        processedLines.push(`<p class="text-theme-text leading-relaxed my-2">${currentParagraph.join("<br>")}</p>`)
        currentParagraph = []
      }
    } else {
      // Regular line - add to current paragraph
      currentParagraph.push(trimmedLine)
    }
  }

  // Finish any remaining paragraph
  if (currentParagraph.length > 0) {
    processedLines.push(`<p class="text-theme-text leading-relaxed my-2">${currentParagraph.join("<br>")}</p>`)
  }

  return processedLines.join("")
}

// Hook for external components to trigger blob URL loading
export function useMarkdownImages(content: string) {
  useEffect(() => {
    // This hook is now handled internally by the MarkdownRenderer component
    // Keeping for backward compatibility
  }, [content])
}
