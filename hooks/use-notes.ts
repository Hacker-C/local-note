"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { notesDB, type Note } from "@/lib/db"
import { imageStorage } from "@/lib/image-storage"
import type { Emotion } from "@/components/emotion-selector"

interface UseNotesReturn {
  notes: Note[]
  loading: boolean
  error: string | null
  isHealthy: boolean
  createNote: (noteData: { title: string; content: string; emotion: Emotion; date: string }) => Promise<Note>
  updateNote: (id: string, updates: Partial<Note>) => Promise<Note>
  deleteNote: (id: string) => Promise<void>
  deleteMultipleNotes: (ids: string[]) => Promise<void>
  getNoteById: (id: string) => Note | undefined
  searchNotes: (query: string) => Promise<Note[]>
  refreshNotes: () => Promise<void>
  clearError: () => void
  retryConnection: () => Promise<void>
}

export function useNotes(): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isHealthy, setIsHealthy] = useState(false)
  const initializationAttempted = useRef(false)
  const retryCount = useRef(0)
  const maxRetries = 3

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Helper function to cleanup unused images based on all notes
  const cleanupUnusedImages = useCallback(async () => {
    try {
      console.log("Starting image cleanup based on all notes...")

      // Get all image IDs referenced in all notes
      const allReferencedImageIds = new Set<string>()

      for (const note of notes) {
        const imageIds = imageStorage.extractImageIds(note.content)
        imageIds.forEach((id) => allReferencedImageIds.add(id))
      }

      const referencedArray = Array.from(allReferencedImageIds)
      console.log(`Found ${referencedArray.length} total referenced images across all notes`)

      // Only cleanup if we have notes to reference
      if (notes.length > 0) {
        await imageStorage.safeCleanupUnusedImages(referencedArray)
      }
    } catch (error) {
      console.error("Failed to cleanup unused images:", error)
    }
  }, [notes])

  const refreshNotes = useCallback(async () => {
    try {
      setError(null)
      const allNotes = await notesDB.getAllNotes()
      setNotes(allNotes)
      setIsHealthy(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load notes"
      setError(errorMessage)
      setIsHealthy(false)
      console.error("Error loading notes:", err)
    }
  }, [])

  const retryConnection = useCallback(async () => {
    if (retryCount.current >= maxRetries) {
      setError("Maximum retry attempts reached. Please refresh the page.")
      return
    }

    retryCount.current++
    setLoading(true)
    setError(null)

    try {
      // Close existing connection
      notesDB.close()

      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount.current))

      // Try to reinitialize
      await notesDB.init()
      await notesDB.seedInitialData() // This will now check if app was initialized before
      await refreshNotes()

      retryCount.current = 0 // Reset on success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reconnect to database"
      setError(`Retry ${retryCount.current}/${maxRetries} failed: ${errorMessage}`)
      console.error("Retry failed:", err)
    } finally {
      setLoading(false)
    }
  }, [refreshNotes])

  const createNote = useCallback(
    async (noteData: { title: string; content: string; emotion: Emotion; date: string }) => {
      try {
        setError(null)
        const newNote = await notesDB.createNote(noteData)

        // Immediately update the notes state to ensure the new note is available
        setNotes((prev) => [newNote, ...prev])

        // Also refresh from database to ensure consistency
        setTimeout(() => {
          refreshNotes().catch(console.error)
        }, 100)

        // Cleanup unused images after creating note
        setTimeout(() => {
          cleanupUnusedImages().catch(console.error)
        }, 5000)

        return newNote
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create note"
        setError(errorMessage)
        setIsHealthy(false)
        throw new Error(errorMessage)
      }
    },
    [refreshNotes, cleanupUnusedImages],
  )

  const updateNote = useCallback(
    async (id: string, updates: Partial<Note>) => {
      try {
        setError(null)
        const updatedNote = await notesDB.updateNote(id, updates)
        setNotes((prev) => prev.map((note) => (note.id === id ? updatedNote : note)))

        // Cleanup unused images after updating note
        setTimeout(() => {
          cleanupUnusedImages().catch(console.error)
        }, 5000)

        return updatedNote
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update note"
        setError(errorMessage)
        setIsHealthy(false)
        throw new Error(errorMessage)
      }
    },
    [cleanupUnusedImages],
  )

  const deleteNote = useCallback(
    async (id: string) => {
      try {
        setError(null)
        await notesDB.deleteNote(id)
        setNotes((prev) => prev.filter((note) => note.id !== id))

        // Cleanup unused images after deleting note
        setTimeout(() => {
          cleanupUnusedImages().catch(console.error)
        }, 2000)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete note"
        setError(errorMessage)
        setIsHealthy(false)
        throw new Error(errorMessage)
      }
    },
    [cleanupUnusedImages],
  )

  const deleteMultipleNotes = useCallback(
    async (ids: string[]) => {
      try {
        setError(null)
        await notesDB.deleteMultipleNotes(ids)
        setNotes((prev) => prev.filter((note) => !ids.includes(note.id)))

        // Cleanup unused images after deleting multiple notes
        setTimeout(() => {
          cleanupUnusedImages().catch(console.error)
        }, 2000)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete notes"
        setError(errorMessage)
        setIsHealthy(false)
        throw new Error(errorMessage)
      }
    },
    [cleanupUnusedImages],
  )

  const getNoteById = useCallback(
    (id: string) => {
      return notes.find((note) => note.id === id)
    },
    [notes],
  )

  const searchNotes = useCallback(async (query: string) => {
    try {
      setError(null)
      return await notesDB.searchNotes(query)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to search notes"
      setError(errorMessage)
      setIsHealthy(false)
      return []
    }
  }, [])

  // Initialize database and load notes
  useEffect(() => {
    const initializeDB = async () => {
      if (initializationAttempted.current) return
      initializationAttempted.current = true

      try {
        // Check if IndexedDB is supported
        const healthy = await notesDB.isHealthy()
        if (!healthy) {
          throw new Error("IndexedDB is not available or supported in this browser")
        }

        await notesDB.init()

        // This will now check if app was initialized before
        // and only add demo data on first launch
        await notesDB.seedInitialData()

        await refreshNotes()
        setLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize database"
        setError(errorMessage)
        setIsHealthy(false)
        setLoading(false)
        console.error("Database initialization failed:", err)
      }
    }

    initializeDB()
  }, [refreshNotes])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't close the database here as other components might be using it
      // The database will be closed on page unload
    }
  }, [])

  return {
    notes,
    loading,
    error,
    isHealthy,
    createNote,
    updateNote,
    deleteNote,
    deleteMultipleNotes,
    getNoteById,
    searchNotes,
    refreshNotes,
    clearError,
    retryConnection,
  }
}
