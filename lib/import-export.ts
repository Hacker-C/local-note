import { notesDB, type Note } from "./db"

export interface ExportData {
  version: string
  exportDate: string
  notes: Note[]
  settings: Record<string, any>
  metadata: {
    totalNotes: number
    exportedBy: string
    appVersion: string
  }
}

export interface ImportResult {
  success: boolean
  imported: {
    notes: number
    settings: number
  }
  errors: string[]
  warnings: string[]
}

export interface ImportPreview {
  totalNotes: number
  existingNotes: number
  newNotes: number
  settings: string[]
  hasValidStructure: boolean
  errors: string[]
}

export class ImportExportManager {
  private static readonly CURRENT_VERSION = "1.0.0"
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  private static readonly CHUNK_SIZE = 1000 // Process in chunks to avoid UI freeze

  // Export functionality
  static async exportAllData(
    onProgress?: (progress: number, status: string) => void,
  ): Promise<{ success: boolean; error?: string; filename?: string }> {
    try {
      onProgress?.(10, "Initializing export...")

      // Initialize database
      await notesDB.init()

      onProgress?.(20, "Fetching notes...")

      // Get all notes
      const notes = await notesDB.getAllNotes()

      onProgress?.(50, "Fetching settings...")

      // Get all settings
      const settings: Record<string, any> = {}
      try {
        settings.theme = await notesDB.getSetting("theme")
      } catch (error) {
        console.warn("Failed to get theme setting:", error)
      }

      onProgress?.(70, "Preparing export data...")

      // Create export data structure
      const exportData: ExportData = {
        version: this.CURRENT_VERSION,
        exportDate: new Date().toISOString(),
        notes,
        settings,
        metadata: {
          totalNotes: notes.length,
          exportedBy: "Local Note App",
          appVersion: this.CURRENT_VERSION,
        },
      }

      onProgress?.(80, "Generating file...")

      // Convert to JSON
      const jsonString = JSON.stringify(exportData, null, 2)

      // Check file size
      const fileSizeBytes = new Blob([jsonString]).size
      if (fileSizeBytes > this.MAX_FILE_SIZE) {
        throw new Error(`Export file too large: ${Math.round(fileSizeBytes / 1024 / 1024)}MB (max: 50MB)`)
      }

      onProgress?.(90, "Downloading file...")

      // Create and trigger download
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0]
      const filename = `notes_backup_${timestamp}.json`

      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      URL.revokeObjectURL(url)

      onProgress?.(100, "Export complete!")

      return { success: true, filename }
    } catch (error) {
      console.error("Export failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      }
    }
  }

  // Import preview functionality
  static async previewImport(file: File): Promise<ImportPreview> {
    const preview: ImportPreview = {
      totalNotes: 0,
      existingNotes: 0,
      newNotes: 0,
      settings: [],
      hasValidStructure: false,
      errors: [],
    }

    try {
      // Check file size
      if (file.size > this.MAX_FILE_SIZE) {
        preview.errors.push(`File too large: ${Math.round(file.size / 1024 / 1024)}MB (max: 50MB)`)
        return preview
      }

      // Check file type
      if (!file.name.toLowerCase().endsWith(".json")) {
        preview.errors.push("File must be a JSON file")
        return preview
      }

      // Read file content
      const content = await this.readFileAsText(file)
      let data: any

      try {
        data = JSON.parse(content)
      } catch (error) {
        preview.errors.push("Invalid JSON format")
        return preview
      }

      // Validate structure
      const validation = this.validateImportData(data)
      if (!validation.isValid) {
        preview.errors.push(...validation.errors)
        return preview
      }

      preview.hasValidStructure = true

      // Get current notes for comparison
      await notesDB.init()
      const existingNotes = await notesDB.getAllNotes()
      const existingIds = new Set(existingNotes.map((note) => note.id))

      // Analyze import data
      const importNotes = data.notes || []
      preview.totalNotes = importNotes.length

      for (const note of importNotes) {
        if (existingIds.has(note.id)) {
          preview.existingNotes++
        } else {
          preview.newNotes++
        }
      }

      // Analyze settings
      if (data.settings) {
        preview.settings = Object.keys(data.settings).filter((key) => data.settings[key] !== undefined)
      }

      return preview
    } catch (error) {
      preview.errors.push(error instanceof Error ? error.message : "Failed to preview import")
      return preview
    }
  }

  // Import functionality
  static async importData(
    file: File,
    options: {
      mergeMode: "merge" | "overwrite"
      importNotes: boolean
      importSettings: boolean
    },
    onProgress?: (progress: number, status: string) => void,
    signal?: AbortSignal,
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: { notes: 0, settings: 0 },
      errors: [],
      warnings: [],
    }

    try {
      if (signal?.aborted) {
        throw new Error("Import cancelled")
      }

      onProgress?.(5, "Reading file...")

      // Read and parse file
      const content = await this.readFileAsText(file)
      const data = JSON.parse(content)

      onProgress?.(10, "Validating data...")

      // Validate data
      const validation = this.validateImportData(data)
      if (!validation.isValid) {
        result.errors.push(...validation.errors)
        return result
      }

      if (signal?.aborted) {
        throw new Error("Import cancelled")
      }

      onProgress?.(20, "Initializing database...")

      // Initialize database
      await notesDB.init()

      // Import notes
      if (options.importNotes && data.notes) {
        onProgress?.(30, "Importing notes...")

        const notes = data.notes as Note[]
        const chunks = this.chunkArray(notes, this.CHUNK_SIZE)

        for (let i = 0; i < chunks.length; i++) {
          if (signal?.aborted) {
            throw new Error("Import cancelled")
          }

          const chunk = chunks[i]
          const progress = 30 + (i / chunks.length) * 50

          onProgress?.(progress, `Importing notes (${i + 1}/${chunks.length})...`)

          await this.importNotesChunk(chunk, options.mergeMode, result)

          // Small delay to prevent UI freeze
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }

      if (signal?.aborted) {
        throw new Error("Import cancelled")
      }

      // Import settings
      if (options.importSettings && data.settings) {
        onProgress?.(85, "Importing settings...")

        for (const [key, value] of Object.entries(data.settings)) {
          if (value !== undefined) {
            try {
              await notesDB.setSetting(key, value)
              result.imported.settings++
            } catch (error) {
              result.warnings.push(`Failed to import setting '${key}': ${error}`)
            }
          }
        }
      }

      onProgress?.(100, "Import complete!")

      result.success = true
      return result
    } catch (error) {
      if (error instanceof Error && error.message === "Import cancelled") {
        result.errors.push("Import was cancelled")
      } else {
        result.errors.push(error instanceof Error ? error.message : "Import failed")
      }
      return result
    }
  }

  // Helper methods
  private static readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsText(file)
    })
  }

  private static validateImportData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data || typeof data !== "object") {
      errors.push("Invalid data format")
      return { isValid: false, errors }
    }

    // Check version compatibility
    if (!data.version) {
      errors.push("Missing version information")
    }

    // Validate notes array
    if (data.notes && !Array.isArray(data.notes)) {
      errors.push("Notes data must be an array")
    } else if (data.notes) {
      for (let i = 0; i < Math.min(data.notes.length, 10); i++) {
        const note = data.notes[i]
        if (!this.isValidNote(note)) {
          errors.push(`Invalid note structure at index ${i}`)
          break
        }
      }
    }

    // Validate settings
    if (data.settings && typeof data.settings !== "object") {
      errors.push("Settings data must be an object")
    }

    return { isValid: errors.length === 0, errors }
  }

  private static isValidNote(note: any): boolean {
    return (
      note &&
      typeof note === "object" &&
      typeof note.id === "string" &&
      typeof note.title === "string" &&
      typeof note.content === "string" &&
      typeof note.date === "string" &&
      typeof note.emotion === "string" &&
      typeof note.createdAt === "number" &&
      typeof note.updatedAt === "number"
    )
  }

  private static async importNotesChunk(
    notes: Note[],
    mergeMode: "merge" | "overwrite",
    result: ImportResult,
  ): Promise<void> {
    for (const note of notes) {
      try {
        if (mergeMode === "overwrite") {
          // Try to update first, then create if not exists
          try {
            await notesDB.updateNote(note.id, note)
            result.imported.notes++
          } catch (error) {
            // If update fails, create new note
            await notesDB.createNote({
              title: note.title,
              content: note.content,
              emotion: note.emotion,
              date: note.date,
            })
            result.imported.notes++
          }
        } else {
          // Merge mode - only create if doesn't exist
          const existing = await notesDB.getNoteById(note.id)
          if (!existing) {
            await notesDB.createNote({
              title: note.title,
              content: note.content,
              emotion: note.emotion,
              date: note.date,
            })
            result.imported.notes++
          }
        }
      } catch (error) {
        result.warnings.push(`Failed to import note '${note.title}': ${error}`)
      }
    }
  }

  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
}
