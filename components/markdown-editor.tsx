"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MarkdownRenderer } from "./markdown-renderer"
import { imageStorage } from "@/lib/image-storage"
import { Upload, Eye, Code, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onAutoSave?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

type EditorTab = "source" | "preview"

interface FormatAction {
  before: string
  after: string
  pattern: RegExp
}

export function MarkdownEditor({
  value,
  onChange,
  onAutoSave,
  placeholder = "Write your note in Markdown...",
  className = "",
  disabled = false,
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>("source")
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadingImages, setUploadingImages] = useState<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>()
  const lastAutoSaveContentRef = useRef<string>("")
  const cleanupTimeoutRef = useRef<NodeJS.Timeout>()

  // Enhanced auto-save functionality with debouncing
  const handleAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      // Only auto-save if content has actually changed and no images are uploading
      if (onAutoSave && value.trim() && value !== lastAutoSaveContentRef.current && uploadingImages.size === 0) {
        console.log("Auto-saving content...")
        lastAutoSaveContentRef.current = value
        onAutoSave(value)
      }
    }, 2000)
  }, [value, onAutoSave, uploadingImages.size])

  useEffect(() => {
    handleAutoSave()
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [handleAutoSave])

  // Mark all referenced images as permanent when content changes
  useEffect(() => {
    const markReferencedImages = async () => {
      try {
        const referencedImageIds = imageStorage.extractImageIds(value)
        console.log(`Marking ${referencedImageIds.length} images as referenced:`, referencedImageIds)

        for (const imageId of referencedImageIds) {
          await imageStorage.markImageAsReferenced(imageId)
        }
      } catch (error) {
        console.error("Failed to mark images as referenced:", error)
      }
    }

    if (value.trim()) {
      markReferencedImages()
    }
  }, [value])

  // Cleanup blob URLs when component unmounts - but don't delete images from storage
  useEffect(() => {
    return () => {
      // Only revoke blob URLs, don't delete images from storage
      const imageIds = imageStorage.extractImageIds(value)
      for (const id of imageIds) {
        imageStorage.revokeBlobUrl(id)
      }
    }
  }, [])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const uploadPromises = Array.from(files).map(async (file) => {
      if (!file.type.startsWith("image/")) {
        console.warn("Only image files are supported")
        return null
      }

      // Check file size (max 10MB for blobs)
      if (file.size > 10 * 1024 * 1024) {
        console.warn("Image file too large (max 10MB)")
        return null
      }

      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      try {
        setUploadingImages((prev) => new Set(prev).add(uploadId))

        // Store the image first
        const storedImage = await imageStorage.storeImage(file)
        console.log(`Image upload completed: ${storedImage.id}`)

        // Create markdown reference
        const markdownImage = `![${file.name}](blob:${storedImage.id})`

        // Insert at cursor position or append - this is synchronous
        const textarea = textareaRef.current
        let newValue: string

        if (textarea) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          newValue = value.slice(0, start) + markdownImage + value.slice(end)

          // Update content immediately
          onChange(newValue)

          // Move cursor after inserted image
          setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start + markdownImage.length, start + markdownImage.length)
          }, 0)
        } else {
          newValue = value + "\n" + markdownImage
          onChange(newValue)
        }

        // Mark image as referenced immediately after insertion
        await imageStorage.markImageAsReferenced(storedImage.id)
        console.log(`Image reference inserted and marked: ${storedImage.id}`)

        return storedImage
      } catch (error) {
        console.error("Failed to upload image:", error)
        return null
      } finally {
        setUploadingImages((prev) => {
          const newSet = new Set(prev)
          newSet.delete(uploadId)
          return newSet
        })
      }
    })

    await Promise.all(uploadPromises)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageUpload(e.target.files)
    // Reset input so same file can be uploaded again
    e.target.value = ""
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleImageUpload(e.dataTransfer.files)
  }

  // Enhanced formatting function with toggle support
  const toggleFormatting = (formatAction: FormatAction) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.slice(start, end)

    // If no text is selected, just insert the formatting markers
    if (start === end) {
      const newText = formatAction.before + formatAction.after
      const newValue = value.slice(0, start) + newText + value.slice(end)
      onChange(newValue)

      // Position cursor between the markers
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + formatAction.before.length, start + formatAction.before.length)
      }, 0)
      return
    }

    // Check if the selected text is already formatted
    const beforeStart = Math.max(0, start - formatAction.before.length)
    const afterEnd = Math.min(value.length, end + formatAction.after.length)
    const textBefore = value.slice(beforeStart, start)
    const textAfter = value.slice(end, afterEnd)

    const isAlreadyFormatted = textBefore === formatAction.before && textAfter === formatAction.after

    let newValue: string
    let newSelectionStart: number
    let newSelectionEnd: number

    if (isAlreadyFormatted) {
      // Remove formatting
      newValue = value.slice(0, beforeStart) + selectedText + value.slice(afterEnd)
      newSelectionStart = beforeStart
      newSelectionEnd = beforeStart + selectedText.length
    } else {
      // Check if the selected text itself contains the formatting
      const trimmedText = selectedText.trim()
      const startsWithFormat = trimmedText.startsWith(formatAction.before)
      const endsWithFormat = trimmedText.endsWith(formatAction.after)

      if (
        startsWithFormat &&
        endsWithFormat &&
        trimmedText.length > formatAction.before.length + formatAction.after.length
      ) {
        // Remove formatting from within the selection
        const unformattedText = trimmedText.slice(formatAction.before.length, -formatAction.after.length)
        newValue = value.slice(0, start) + unformattedText + value.slice(end)
        newSelectionStart = start
        newSelectionEnd = start + unformattedText.length
      } else {
        // Add formatting
        const formattedText = formatAction.before + selectedText + formatAction.after
        newValue = value.slice(0, start) + formattedText + value.slice(end)
        newSelectionStart = start + formatAction.before.length
        newSelectionEnd = end + formatAction.before.length
      }
    }

    onChange(newValue)

    // Restore selection
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newSelectionStart, newSelectionEnd)
    }, 0)
  }

  // Format actions with patterns for detection
  const formatActions = {
    bold: {
      before: "**",
      after: "**",
      pattern: /\*\*(.*?)\*\*/g,
    },
    italic: {
      before: "*",
      after: "*",
      pattern: /\*(.*?)\*/g,
    },
    code: {
      before: "`",
      after: "`",
      pattern: /`(.*?)`/g,
    },
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!textareaRef.current || textareaRef.current !== document.activeElement) return

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey

      if (ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault()
            toggleFormatting(formatActions.bold)
            break
          case "i":
            e.preventDefault()
            toggleFormatting(formatActions.italic)
            break
          case "`":
            e.preventDefault()
            toggleFormatting(formatActions.code)
            break
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [value])

  // REMOVED: The aggressive cleanup that was deleting images
  // The cleanup will now only happen when the component is completely unmounted
  // or when the parent component explicitly calls cleanup

  return (
    <div className={cn("space-y-4", className)}>
      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex bg-theme-card-accent rounded-lg p-1 border border-theme-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("source")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              activeTab === "source"
                ? "bg-theme-card text-theme-text shadow-sm"
                : "text-theme-text-muted hover:text-theme-text hover:bg-theme-card/50",
            )}
          >
            <Code className="mr-2 h-4 w-4" />
            Source
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("preview")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              activeTab === "preview"
                ? "bg-theme-card text-theme-text shadow-sm"
                : "text-theme-text-muted hover:text-theme-text hover:bg-theme-card/50",
            )}
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
        </div>

        {/* Formatting Toolbar (only show in source mode) */}
        {activeTab === "source" && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFormatting(formatActions.bold)}
              className="btn-theme-outline"
              disabled={disabled}
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFormatting(formatActions.italic)}
              className="btn-theme-outline"
              disabled={disabled}
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFormatting(formatActions.code)}
              className="btn-theme-outline"
              disabled={disabled}
              title="Inline Code (Ctrl+`)"
            >
              {"</>"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="btn-theme-outline"
              disabled={disabled || uploadingImages.size > 0}
              title="Upload Image"
            >
              {uploadingImages.size > 0 ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-theme-border border-t-theme-primary mr-1" />
                  <span className="text-xs">{uploadingImages.size}</span>
                </div>
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Upload Status */}
      {uploadingImages.size > 0 && (
        <div className="text-sm text-theme-text-muted bg-theme-card-accent p-2 rounded border border-theme-border">
          Uploading {uploadingImages.size} image{uploadingImages.size !== 1 ? "s" : ""}... Auto-save is paused.
        </div>
      )}

      {/* Editor Content */}
      <div className="relative">
        {activeTab === "source" ? (
          <div
            className={cn(
              "relative border-2 border-dashed rounded-lg transition-colors",
              isDragOver ? "border-theme-primary bg-theme-card-accent" : "border-transparent",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleTextChange}
              placeholder={placeholder}
              className="min-h-[300px] resize-none font-mono text-sm bg-theme-input border-theme-border text-theme-text placeholder:text-theme-text-muted"
              disabled={disabled}
            />
            {isDragOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-theme-card-accent/80 rounded-lg">
                <div className="text-center">
                  <Upload className="h-8 w-8 text-theme-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-theme-text">Drop images here to upload</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-[300px] p-4 bg-theme-input border border-theme-border rounded-lg">
            {value.trim() ? (
              <MarkdownRenderer content={value} className="text-theme-text" />
            ) : (
              <p className="text-theme-text-muted italic">
                Nothing to preview yet. Switch to Source tab to start writing.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Markdown Help */}
      {activeTab === "source" && (
        <div className="text-xs text-theme-text-muted space-y-1">
          <p>
            <strong>Markdown Quick Reference:</strong>
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <code># Heading 1</code> • <code>## Heading 2</code>
            </div>
            <div>
              <code>**bold**</code> • <code>*italic*</code> • <code>~~strikethrough~~</code>
            </div>
            <div>
              <code>`inline code`</code> • <code>\`\`\`code block\`\`\`</code>
            </div>
            <div>
              <code>&gt; blockquote</code> • Drag & drop images
            </div>
          </div>
          <p className="text-xs text-theme-text-muted mt-2">
            <strong>Shortcuts:</strong> Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+` (Code)
          </p>
        </div>
      )}
    </div>
  )
}
