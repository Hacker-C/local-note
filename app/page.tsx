"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { EmotionSelector } from "@/components/emotion-selector"
import { ThemeSelector } from "@/components/theme-selector"
import { LoadingState, LoadingSpinner } from "@/components/loading-spinner"
import { useNotes } from "@/hooks/use-notes"
import { useSearch } from "@/hooks/use-search"
import { Trash2, X, RefreshCw, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Footer } from "@/components/footer"
import ImportExportDialog from "@/components/import-export-dialog"

export default function NotesPage() {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showImportExport, setShowImportExport] = useState(false)

  // Notes and search
  const {
    notes,
    loading,
    error,
    isHealthy,
    createNote,
    deleteMultipleNotes,
    clearError,
    retryConnection,
    refreshNotes,
  } = useNotes()
  const { searchQuery, setSearchQuery, filteredNotes, isSearching, clearSearch } = useSearch(notes)

  const handleSelectModeToggle = () => {
    setIsSelectionMode(true)
    setSelectedNotes(new Set())
  }

  const handleExitSelectMode = () => {
    setIsSelectionMode(false)
    setSelectedNotes(new Set())
  }

  const handleNoteSelection = (noteId: string, checked: boolean) => {
    const newSelectedNotes = new Set(selectedNotes)
    if (checked) {
      newSelectedNotes.add(noteId)
    } else {
      newSelectedNotes.delete(noteId)
    }
    setSelectedNotes(newSelectedNotes)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotes(new Set(filteredNotes.map((note) => note.id)))
    } else {
      setSelectedNotes(new Set())
    }
  }

  const handleDeleteSelected = () => {
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteMultipleNotes(Array.from(selectedNotes))
      setSelectedNotes(new Set())
      setIsSelectionMode(false)
      setShowDeleteDialog(false)
    } catch (err) {
      console.error("Failed to delete notes:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  const cancelDelete = () => {
    setShowDeleteDialog(false)
  }

  const isAllSelected = filteredNotes.length > 0 && selectedNotes.size === filteredNotes.length
  const isIndeterminate = selectedNotes.size > 0 && selectedNotes.size < filteredNotes.length

  // Show loading state while initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-theme-bg p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto bg-theme-card rounded-xl p-8 shadow-sm border border-theme-border">
          <LoadingState message="Initializing your notes..." />
        </div>
      </div>
    )
  }

  // Show error state with retry option
  if (error && !isHealthy) {
    return (
      <div className="min-h-screen bg-theme-bg p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto bg-theme-card rounded-xl p-8 shadow-sm border border-theme-border">
          <div className="text-center p-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme-text mb-2">Connection Error</h2>
            <p className="text-theme-text-muted mb-6 max-w-md mx-auto">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={retryConnection}
                className="bg-theme-primary text-theme-primary-foreground hover:bg-theme-primary/90"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Connection
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" className="btn-theme-outline">
                Refresh Page
              </Button>
            </div>
            <p className="text-sm text-theme-text-muted mt-4">
              If the problem persists, try using a different browser or clearing your browser data.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-theme-bg p-6 transition-colors duration-300">
      <div className="max-w-4xl mx-auto bg-theme-card rounded-xl p-8 shadow-sm border border-theme-border">
        {/* Error banner for non-critical errors */}
        {error && isHealthy && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">{error}</span>
            </div>
            <Button onClick={clearError} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <header className="text-center mb-6">
          <div className="flex items-center justify-between mb-4">
            <div></div> {/* Empty div for spacing */}
            <h1 className="text-4xl font-serif font-bold text-theme-text">Local Notes</h1>
            <ThemeSelector />
          </div>
          <p className="text-theme-text-muted mt-1">Capture your thoughts and ideas, all data processing stay 100% local (no server uploads)</p>

          {/* Selection mode controls - shown only when in selection mode */}
          {isSelectionMode && (
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className="data-[state=indeterminate]:bg-theme-primary data-[state=indeterminate]:text-theme-primary-foreground"
                  {...(isIndeterminate && { "data-state": "indeterminate" })}
                />
                <Label htmlFor="select-all" className="text-sm font-medium text-theme-text">
                  Select All
                </Label>
              </div>
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={selectedNotes.size === 0 || isDeleting}
                className="rounded-full"
              >
                {isDeleting ? <LoadingSpinner size="sm" className="mr-2" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete ({selectedNotes.size})
              </Button>
              <Button variant="outline" onClick={handleExitSelectMode} className="rounded-full btn-theme-outline">
                <X className="mr-2 h-4 w-4" />
                Exit Select
              </Button>
            </div>
          )}
        </header>

        <Separator className="my-6 bg-theme-border" />

        <div className="mb-6">
          <Input
            type="search"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-full bg-theme-input border-theme-border text-theme-text placeholder:text-theme-text-muted"
          />
          {isSearching && (
            <p className="text-sm text-theme-text-muted mt-2">
              Found {filteredNotes.length} note{filteredNotes.length !== 1 ? "s" : ""} matching "{searchQuery}"
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <Button
            variant="outline"
            onClick={() => setShowImportExport(true)}
            className="rounded-full btn-theme-outline"
          >
            Import & Export
          </Button>
          {!isSelectionMode && (
            <Button variant="outline" onClick={handleSelectModeToggle} className="rounded-full btn-theme-outline">
              Select
            </Button>
          )}
          <Link href="/note/new">
            <Button
              className="rounded-full bg-theme-primary text-theme-primary-foreground hover:bg-theme-primary/90 transition-all duration-300"
              disabled={!isHealthy}
            >
              New Note
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-theme-text-muted text-lg">
                {isSearching ? "No notes found matching your search." : "No notes yet. Create your first note!"}
              </p>
              {isSearching && (
                <Button variant="outline" onClick={clearSearch} className="mt-4 btn-theme-outline">
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            filteredNotes.map((note) => (
              <Card
                key={note.id}
                className="p-5 bg-theme-card-accent border-theme-border hover:bg-theme-card-accent-hover transition-colors"
              >
                <div className="flex items-start gap-4">
                  {isSelectionMode && (
                    <div className="flex items-center pt-1">
                      <Checkbox
                        id={`note-${note.id}`}
                        checked={selectedNotes.has(note.id)}
                        onCheckedChange={(checked) => handleNoteSelection(note.id, checked as boolean)}
                      />
                    </div>
                  )}
                  <Link
                    href={`/note/${note.id}`}
                    className={`block flex-1 ${isSelectionMode ? "pointer-events-none" : "cursor-pointer"}`}
                  >
                    <div className="flex justify-between items-start">
                      <h2 className="text-xl font-semibold text-theme-text">{note.title}</h2>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm text-theme-text-muted">{note.date}</span>
                        <EmotionSelector selectedEmotion={note.emotion} readonly size="sm" />
                      </div>
                    </div>
                    <p className="mt-2 text-theme-text-muted line-clamp-2">{note.content}</p>
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-theme-card border-theme-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-theme-text">Delete Selected Notes</AlertDialogTitle>
              <AlertDialogDescription className="text-theme-text-muted">
                Are you sure you want to delete the selected {selectedNotes.size} note
                {selectedNotes.size !== 1 ? "s" : ""}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelDelete} disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Confirm"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Import/Export Dialog */}
        <ImportExportDialog
          open={showImportExport}
          onOpenChange={setShowImportExport}
          onImportComplete={refreshNotes}
        />

        {/* Footer - hidden during selection mode */}
        {!isSelectionMode && <Footer className="mt-8" />}
      </div>
    </div>
  )
}
