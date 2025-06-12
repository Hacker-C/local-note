"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { EmotionSelector, type Emotion } from "@/components/emotion-selector"
import { ThemeSelector } from "@/components/theme-selector"
import { LoadingState, LoadingSpinner } from "@/components/loading-spinner"
import { useNotes } from "@/hooks/use-notes"
import { ArrowLeft, ArrowRight, Edit, Save, X } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import type { Note } from "@/lib/db"
import { Footer } from "@/components/footer"
import { MarkdownEditor } from "@/components/markdown-editor"
import { MarkdownRenderer } from "@/components/markdown-renderer"

export default function NoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const noteId = params.id as string

  const { notes, loading, error, updateNote } = useNotes()
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editEmotion, setEditEmotion] = useState<Emotion>("Calm")
  const [isSaving, setIsSaving] = useState(false)

  // Route validation - handle reserved words and invalid IDs
  useEffect(() => {
    const reservedWords = ["new", "create", "add", "edit"]

    if (!noteId || reservedWords.includes(noteId.toLowerCase())) {
      if (noteId?.toLowerCase() === "new") {
        router.replace("/note/new")
      } else {
        router.replace("/")
      }
      return
    }
  }, [noteId, router])

  // Early return if this is a reserved route
  if (!noteId || ["new", "create", "add", "edit"].includes(noteId.toLowerCase())) {
    return (
      <div className="min-h-screen bg-theme-bg p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto bg-theme-card rounded-xl p-8 shadow-sm border border-theme-border">
          <LoadingState message="Redirecting..." />
        </div>
      </div>
    )
  }

  // Find current note and navigation
  useEffect(() => {
    if (!noteId) return
    if (loading) return

    // Additional validation for note ID format
    if (noteId.trim() === "") return

    const foundNote = notes.find((note) => note.id === noteId)
    if (foundNote) {
      setCurrentNote(foundNote)
      setNotFound(false)
    } else if (notes.length > 0) {
      // If we have notes but can't find this one, it's truly not found
      setNotFound(true)
    }
  }, [noteId, notes, loading])

  const currentNoteIndex = notes.findIndex((note) => note.id === noteId)
  const prevNoteId = currentNoteIndex > 0 ? notes[currentNoteIndex - 1].id : null
  const nextNoteId = currentNoteIndex < notes.length - 1 ? notes[currentNoteIndex + 1].id : null

  const handleEditClick = () => {
    if (!currentNote) return
    setEditTitle(currentNote.title)
    setEditContent(currentNote.content)
    setEditEmotion(currentNote.emotion)
    setIsEditing(true)
  }

  const handleSaveChanges = async () => {
    if (!currentNote || !editTitle.trim() || !editContent.trim()) return

    setIsSaving(true)
    try {
      const updatedNote = await updateNote(currentNote.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        emotion: editEmotion,
      })

      setCurrentNote(updatedNote)
      setIsEditing(false)
    } catch (err) {
      console.error("Failed to update note:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle("")
    setEditContent("")
    setEditEmotion("Calm")
  }

  // Show loading state while initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-theme-bg p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto bg-theme-card rounded-xl p-8 shadow-sm border border-theme-border">
          <LoadingState message="Loading note..." />
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-theme-bg p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto bg-theme-card rounded-xl p-8 shadow-sm border border-theme-border">
          <div className="text-center p-8">
            <p className="text-red-600 mb-4">Error: {error}</p>
            <Link href="/">
              <Button className="btn-theme-outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Show not found state
  if (notFound || !currentNote) {
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
          <div className="text-center p-8">
            <p className="text-theme-text text-lg mb-4">Note not found</p>
            <p className="text-theme-text-muted">The note you're looking for doesn't exist or may have been deleted.</p>
            <div className="mt-4">
              <Link href="/note/new">
                <Button className="bg-theme-primary text-theme-primary-foreground hover:bg-theme-primary/90">
                  Create New Note
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
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

        <article className="space-y-4">
          {isEditing ? (
            // Edit Mode
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="edit-title" className="text-sm font-medium text-theme-text-muted">
                  Title
                </Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-serif font-bold bg-theme-input border-theme-border text-theme-text"
                  placeholder="Enter note title"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-theme-text-muted">Mood</Label>
                <EmotionSelector selectedEmotion={editEmotion} onEmotionChange={setEditEmotion} readonly={isSaving} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-content" className="text-sm font-medium text-theme-text-muted">
                  Content
                </Label>
                <MarkdownEditor
                  value={editContent}
                  onChange={setEditContent}
                  onAutoSave={(content) => {
                    // Auto-save functionality
                    if (currentNote && content !== currentNote.content) {
                      console.log("Auto-saving content...")
                      // You could implement auto-save here if desired
                    }
                  }}
                  placeholder="Write your note in Markdown..."
                  disabled={isSaving}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="rounded-full btn-theme-outline"
                  disabled={isSaving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveChanges}
                  className="rounded-full bg-theme-primary text-theme-primary-foreground hover:bg-theme-primary/90"
                  disabled={isSaving || !editTitle.trim() || !editContent.trim()}
                >
                  {isSaving ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Read-only Mode
            <>
              <h1 className="text-4xl font-serif font-bold text-theme-text">{currentNote.title}</h1>

              <div className="flex items-center justify-between">
                <p className="text-theme-text-muted">{currentNote.date}</p>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-theme-text-muted">Mood:</span>
                  <EmotionSelector selectedEmotion={currentNote.emotion} readonly />
                </div>
              </div>

              <div className="mt-8">
                <MarkdownRenderer content={currentNote.content} className="text-theme-text" />
              </div>
            </>
          )}
        </article>

        <Separator className="my-8 bg-theme-border" />

        {!isEditing && (
          <div className="flex justify-center mb-6">
            <Button
              onClick={handleEditClick}
              variant="outline"
              className="rounded-full border-2 border-theme-primary text-theme-primary hover:bg-theme-card-accent btn-theme-outline"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        )}

        {!isEditing && (
          <div className="flex justify-between">
            {prevNoteId ? (
              <Link href={`/note/${prevNoteId}`}>
                <Button variant="outline" className="rounded-full btn-theme-outline">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Previous Note
                </Button>
              </Link>
            ) : (
              <div></div>
            )}

            {nextNoteId ? (
              <Link href={`/note/${nextNoteId}`}>
                <Button variant="outline" className="rounded-full btn-theme-outline">
                  Next Note <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <div></div>
            )}
          </div>
        )}

        {/* Footer - hidden during editing mode */}
        {!isEditing && <Footer className="mt-8" />}
      </div>
    </div>
  )
}
