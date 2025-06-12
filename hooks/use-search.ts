"use client"

import { useState, useCallback, useMemo } from "react"
import type { Note } from "@/lib/db"

interface UseSearchReturn {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filteredNotes: Note[]
  isSearching: boolean
  clearSearch: () => void
}

export function useSearch(notes: Note[]): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) {
      return notes
    }

    const lowercaseQuery = searchQuery.toLowerCase()
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(lowercaseQuery) || note.content.toLowerCase().includes(lowercaseQuery),
    )
  }, [notes, searchQuery])

  const clearSearch = useCallback(() => {
    setSearchQuery("")
  }, [])

  const isSearching = searchQuery.trim().length > 0

  return {
    searchQuery,
    setSearchQuery,
    filteredNotes,
    isSearching,
    clearSearch,
  }
}
