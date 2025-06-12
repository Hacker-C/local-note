"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { EmotionSelector, type Emotion } from "@/components/emotion-selector"
import { ThemeSelector } from "@/components/theme-selector"
import { LoadingSpinner } from "@/components/loading-spinner"
import { useNotes } from "@/hooks/use-notes"
import { ArrowLeft, Save, X } from "lucide-react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Footer } from "@/components/footer"
import { MarkdownEditor } from "@/components/markdown-editor"

export default function NewNotePage() {
  const router = useRouter()
  const pathname = usePathname()
  const { createNote } = useNotes()

  // Route validation - ensure we're on the correct path
  useEffect(() => {
    if (pathname !== "/note/new") {
      router.replace("/note/new")
      return
    }
  }, [pathname, router])

  // Form state - pre-populated with defaults
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [emotion, setEmotion] = useState<Emotion>("Calm") // Default neutral mood
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get current date in the same format as existing notes
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      const newNote = await createNote({
        title: title.trim(),
        content: content.trim(),
        emotion,
        date: currentDate,
      })

      // Redirect to the newly created note detail view
      router.push(`/note/${newNote.id}`)
    } catch (err) {
      console.error("Failed to create note:", err)
      setError(err instanceof Error ? err.message : "Failed to create note")
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    router.push("/")
  }

  // Prevent rendering if not on correct path
  if (pathname !== "/note/new") {
    return null
  }

  return (
    <div className="min-h-screen bg-theme-bg p-6 transition-colors duration-300">
      <div className="max-w-4xl mx-auto bg-theme-card rounded-xl p-8 shadow-sm border border-theme-border">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="outline" className="btn-theme-outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
          <ThemeSelector />
        </div>

        {/* Error display */}
        {error && <div className="mb-6 p-3 rounded-lg border-2 error-message">{error}</div>}

        {/* Note creation form using same layout as edit mode */}
        <article className="space-y-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium text-theme-text-muted">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-4xl font-serif font-bold bg-theme-input border-theme-border text-theme-text"
                placeholder="Enter note title"
                disabled={isSaving}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-theme-text-muted">{currentDate}</p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-theme-text-muted">Mood:</span>
                <div className="min-w-0">
                  <EmotionSelector selectedEmotion={emotion} onEmotionChange={setEmotion} readonly={isSaving} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="text-sm font-medium text-theme-text-muted">
                Content
              </Label>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                onAutoSave={(content) => {
                  console.log("Auto-saving draft...")
                  // Could implement draft saving here
                }}
                placeholder="Write your note in Markdown..."
                disabled={isSaving}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="rounded-full btn-theme-outline"
                disabled={isSaving}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="rounded-full bg-theme-primary text-theme-primary-foreground hover:bg-theme-primary/90"
                disabled={isSaving || !title.trim() || !content.trim()}
              >
                {isSaving ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Note
                  </>
                )}
              </Button>
            </div>
          </div>
        </article>

        <Separator className="my-8 bg-theme-border" />

        <Footer className="mt-8" />
      </div>
    </div>
  )
}
