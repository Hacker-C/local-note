export interface Note {
  id: string
  title: string
  content: string
  date: string
  emotion: "Calm" | "Happy" | "Funny" | "Depressed" | "Sad" | "Angry"
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  id: string
  theme: string
  lastUpdated: number
}

class NotesDB {
  private db: IDBDatabase | null = null
  private readonly dbName = "NotesApp"
  private readonly version = 1
  private initPromise: Promise<void> | null = null
  private isSupported = true

  constructor() {
    // Check IndexedDB support
    this.isSupported = this.checkIndexedDBSupport()
  }

  private checkIndexedDBSupport(): boolean {
    try {
      return typeof indexedDB !== "undefined" && indexedDB !== null
    } catch (error) {
      console.warn("IndexedDB not supported:", error)
      return false
    }
  }

  async init(): Promise<void> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise
    }

    // Check if already initialized
    if (this.db) {
      return Promise.resolve()
    }

    // Check support
    if (!this.isSupported) {
      throw new Error("IndexedDB is not supported in this browser")
    }

    this.initPromise = this.initializeDatabase()
    return this.initPromise
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest

      try {
        request = indexedDB.open(this.dbName, this.version)
      } catch (error) {
        reject(new Error(`Failed to open IndexedDB: ${error}`))
        return
      }

      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (request) {
          try {
            // request?.abort?.()
          } catch (e) {
            // Ignore abort errors
          }
        }
        reject(new Error("Database initialization timeout"))
      }, 10000) // 10 second timeout

      request.onerror = () => {
        clearTimeout(timeout)
        const error = request.error || new Error("Unknown database error")
        console.error("IndexedDB error:", error)
        reject(new Error(`Database error: ${error.message}`))
      }

      request.onsuccess = () => {
        clearTimeout(timeout)
        try {
          this.db = request.result

          // Add error handler for the database connection
          this.db.onerror = (event) => {
            console.error("Database error:", event)
          }

          this.db.onversionchange = () => {
            this.db?.close()
            this.db = null
            console.warn("Database version changed, please refresh the page")
          }

          resolve()
        } catch (error) {
          reject(new Error(`Failed to initialize database: ${error}`))
        }
      }

      request.onupgradeneeded = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result

          // Notes object store
          if (!db.objectStoreNames.contains("notes")) {
            const notesStore = db.createObjectStore("notes", { keyPath: "id" })
            notesStore.createIndex("date", "date", { unique: false })
            notesStore.createIndex("emotion", "emotion", { unique: false })
            notesStore.createIndex("createdAt", "createdAt", { unique: false })
            notesStore.createIndex("updatedAt", "updatedAt", { unique: false })
          }

          // Settings object store
          if (!db.objectStoreNames.contains("settings")) {
            db.createObjectStore("settings", { keyPath: "id" })
          }
        } catch (error) {
          clearTimeout(timeout)
          reject(new Error(`Failed to upgrade database: ${error}`))
        }
      }

      request.onblocked = () => {
        clearTimeout(timeout)
        reject(new Error("Database upgrade blocked. Please close other tabs and try again."))
      }
    })
  }

  private ensureDB(): IDBDatabase {
    if (!this.isSupported) {
      throw new Error("IndexedDB is not supported")
    }
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.")
    }
    return this.db
  }

  private async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error)

        // If database connection is lost, try to reinitialize
        if (error instanceof Error && error.message.includes("database")) {
          this.db = null
          this.initPromise = null
          try {
            await this.init()
          } catch (initError) {
            console.error("Failed to reinitialize database:", initError)
          }
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100))
        }
      }
    }

    throw lastError!
  }

  // Notes CRUD operations with retry logic
  async getAllNotes(): Promise<Note[]> {
    return this.withRetry(async () => {
      const db = this.ensureDB()
      return new Promise<Note[]>((resolve, reject) => {
        try {
          const transaction = db.transaction(["notes"], "readonly")
          const store = transaction.objectStore("notes")
          const index = store.index("createdAt")
          const request = index.getAll()

          transaction.onerror = () => reject(transaction.error || new Error("Transaction failed"))
          transaction.onabort = () => reject(new Error("Transaction aborted"))

          request.onsuccess = () => {
            try {
              // Sort by creation date, newest first
              const notes = request.result.sort((a, b) => b.createdAt - a.createdAt)
              resolve(notes)
            } catch (error) {
              reject(new Error(`Failed to process notes: ${error}`))
            }
          }
          request.onerror = () => reject(request.error || new Error("Failed to get notes"))
        } catch (error) {
          reject(new Error(`Database operation failed: ${error}`))
        }
      })
    })
  }

  async getNoteById(id: string): Promise<Note | null> {
    return this.withRetry(async () => {
      const db = this.ensureDB()
      return new Promise<Note | null>((resolve, reject) => {
        try {
          const transaction = db.transaction(["notes"], "readonly")
          const store = transaction.objectStore("notes")
          const request = store.get(id)

          transaction.onerror = () => reject(transaction.error || new Error("Transaction failed"))
          request.onsuccess = () => resolve(request.result || null)
          request.onerror = () => reject(request.error || new Error("Failed to get note"))
        } catch (error) {
          reject(new Error(`Database operation failed: ${error}`))
        }
      })
    })
  }

  async createNote(noteData: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note> {
    return this.withRetry(async () => {
      const db = this.ensureDB()
      const now = Date.now()
      const note: Note = {
        ...noteData,
        id: `note_${now}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      }

      return new Promise<Note>((resolve, reject) => {
        try {
          const transaction = db.transaction(["notes"], "readwrite")
          const store = transaction.objectStore("notes")
          const request = store.add(note)

          transaction.onerror = () => reject(transaction.error || new Error("Transaction failed"))
          request.onsuccess = () => resolve(note)
          request.onerror = () => reject(request.error || new Error("Failed to create note"))
        } catch (error) {
          reject(new Error(`Database operation failed: ${error}`))
        }
      })
    })
  }

  async updateNote(id: string, updates: Partial<Omit<Note, "id" | "createdAt">>): Promise<Note> {
    return this.withRetry(async () => {
      const existingNote = await this.getNoteById(id)

      if (!existingNote) {
        throw new Error(`Note with id ${id} not found`)
      }

      const updatedNote: Note = {
        ...existingNote,
        ...updates,
        updatedAt: Date.now(),
      }

      const db = this.ensureDB()
      return new Promise<Note>((resolve, reject) => {
        try {
          const transaction = db.transaction(["notes"], "readwrite")
          const store = transaction.objectStore("notes")
          const request = store.put(updatedNote)

          transaction.onerror = () => reject(transaction.error || new Error("Transaction failed"))
          request.onsuccess = () => resolve(updatedNote)
          request.onerror = () => reject(request.error || new Error("Failed to update note"))
        } catch (error) {
          reject(new Error(`Database operation failed: ${error}`))
        }
      })
    })
  }

  async deleteNote(id: string): Promise<void> {
    return this.withRetry(async () => {
      const db = this.ensureDB()
      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction(["notes"], "readwrite")
          const store = transaction.objectStore("notes")
          const request = store.delete(id)

          transaction.onerror = () => reject(transaction.error || new Error("Transaction failed"))
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error || new Error("Failed to delete note"))
        } catch (error) {
          reject(new Error(`Database operation failed: ${error}`))
        }
      })
    })
  }

  async deleteMultipleNotes(ids: string[]): Promise<void> {
    return this.withRetry(async () => {
      const db = this.ensureDB()
      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction(["notes"], "readwrite")
          const store = transaction.objectStore("notes")

          let completed = 0
          let hasError = false
          const errors: Error[] = []

          const checkComplete = () => {
            completed++
            if (completed === ids.length) {
              if (hasError) {
                reject(new Error(`Failed to delete some notes: ${errors.map((e) => e.message).join(", ")}`))
              } else {
                resolve()
              }
            }
          }

          transaction.onerror = () => {
            hasError = true
            errors.push(transaction.error || new Error("Transaction failed"))
            reject(new Error("Transaction failed"))
          }

          ids.forEach((id) => {
            const request = store.delete(id)
            request.onsuccess = checkComplete
            request.onerror = () => {
              hasError = true
              errors.push(request.error || new Error(`Failed to delete note ${id}`))
              checkComplete()
            }
          })
        } catch (error) {
          reject(new Error(`Database operation failed: ${error}`))
        }
      })
    })
  }

  // Settings operations
  async getSetting(key: string): Promise<any> {
    return this.withRetry(async () => {
      const db = this.ensureDB()
      return new Promise<any>((resolve, reject) => {
        try {
          const transaction = db.transaction(["settings"], "readonly")
          const store = transaction.objectStore("settings")
          const request = store.get(key)

          transaction.onerror = () => reject(transaction.error || new Error("Transaction failed"))
          request.onsuccess = () => {
            const result = request.result
            resolve(result ? result.value : null)
          }
          request.onerror = () => reject(request.error || new Error("Failed to get setting"))
        } catch (error) {
          reject(new Error(`Database operation failed: ${error}`))
        }
      })
    })
  }

  async setSetting(key: string, value: any): Promise<void> {
    return this.withRetry(async () => {
      const db = this.ensureDB()
      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction(["settings"], "readwrite")
          const store = transaction.objectStore("settings")
          const request = store.put({ id: key, value, lastUpdated: Date.now() })

          transaction.onerror = () => reject(transaction.error || new Error("Transaction failed"))
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error || new Error("Failed to set setting"))
        } catch (error) {
          reject(new Error(`Database operation failed: ${error}`))
        }
      })
    })
  }

  // Search functionality
  async searchNotes(query: string): Promise<Note[]> {
    try {
      const allNotes = await this.getAllNotes()
      const lowercaseQuery = query.toLowerCase()

      return allNotes.filter(
        (note) =>
          note.title.toLowerCase().includes(lowercaseQuery) || note.content.toLowerCase().includes(lowercaseQuery),
      )
    } catch (error) {
      console.error("Search failed:", error)
      return []
    }
  }

  // Check if app has been initialized before
  async hasBeenInitialized(): Promise<boolean> {
    try {
      const initialized = await this.getSetting("appInitialized")
      return initialized === true
    } catch (error) {
      console.error("Failed to check initialization status:", error)
      return false
    }
  }

  // Mark app as initialized
  async markAsInitialized(): Promise<void> {
    try {
      await this.setSetting("appInitialized", true)
    } catch (error) {
      console.error("Failed to mark app as initialized:", error)
    }
  }

  // Seed initial data only if this is the first launch
  async seedInitialData(): Promise<void> {
    try {
      // Check if app has been initialized before
      const initialized = await this.hasBeenInitialized()
      if (initialized) {
        console.log("App already initialized, skipping demo data")
        return
      }

      // Check if there are any existing notes
      const existingNotes = await this.getAllNotes()
      if (existingNotes.length > 0) {
        // If there are notes but app wasn't marked as initialized,
        // mark it now but don't add demo data
        await this.markAsInitialized()
        return
      }

      // This is the first launch, add demo data
      // const initialNotes = []

      // for (const noteData of initialNotes) {
      //   await this.createNote(noteData)
      // }

      // Mark app as initialized after adding demo data
      await this.markAsInitialized()
      console.log("Demo data added and app marked as initialized")
    } catch (error) {
      console.error("Failed to seed initial data:", error)
      // Don't throw here, as this is not critical
    }
  }

  // Cleanup method
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isSupported) return false
      await this.init()
      // Try a simple operation
      await this.getAllNotes()
      return true
    } catch (error) {
      console.error("Database health check failed:", error)
      return false
    }
  }
}

export const notesDB = new NotesDB()

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    notesDB.close()
  })
}
