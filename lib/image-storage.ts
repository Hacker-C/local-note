export interface StoredImage {
  id: string
  filename: string
  blob: Blob
  mimeType: string
  size: number
  uploadedAt: number
  isTemporary?: boolean // Add flag for newly uploaded images
  lastReferencedAt?: number // Track when image was last referenced
}

export interface ImageMetadata {
  id: string
  filename: string
  mimeType: string
  size: number
  uploadedAt: number
  isTemporary?: boolean
  lastReferencedAt?: number
}

class ImageStorage {
  private db: IDBDatabase | null = null
  private readonly dbName = "NotesAppImages"
  private readonly version = 3 // Increment for schema changes
  private initPromise: Promise<void> | null = null
  private blobUrlCache = new Map<string, string>()
  private pendingImages = new Set<string>() // Track images being uploaded
  private readonly CLEANUP_GRACE_PERIOD = 300000 // 5 minutes grace period (increased)

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    if (this.db) {
      return Promise.resolve()
    }

    this.initPromise = this.initializeDatabase()
    return this.initPromise
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(new Error("Failed to open image database"))
      }

      request.onsuccess = () => {
        this.db = request.result

        // Add error handler for the database connection
        this.db.onerror = (event) => {
          console.error("Image database error:", event)
        }

        this.db.onversionchange = () => {
          this.db?.close()
          this.db = null
          console.warn("Image database version changed, please refresh the page")
        }

        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Clear old stores if they exist (for migration from base64 to blob)
        if (db.objectStoreNames.contains("images")) {
          db.deleteObjectStore("images")
        }

        // Create new blob-based image store with additional fields
        const imageStore = db.createObjectStore("images", { keyPath: "id" })
        imageStore.createIndex("filename", "filename", { unique: false })
        imageStore.createIndex("uploadedAt", "uploadedAt", { unique: false })
        imageStore.createIndex("mimeType", "mimeType", { unique: false })
        imageStore.createIndex("isTemporary", "isTemporary", { unique: false })
        imageStore.createIndex("lastReferencedAt", "lastReferencedAt", { unique: false })
      }

      request.onblocked = () => {
        reject(new Error("Database upgrade blocked. Please close other tabs and try again."))
      }
    })
  }

  async storeImage(file: File): Promise<StoredImage> {
    await this.init()

    if (!this.db) {
      throw new Error("Database not initialized")
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image")
    }

    // Validate file size (max 10MB for blobs since they're more efficient)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Image file too large (max 10MB)")
    }

    // Generate unique ID
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Mark as pending to prevent premature cleanup
    this.pendingImages.add(imageId)
    console.log(`Starting image upload: ${imageId} (${file.name})`)

    try {
      // Create blob from file
      const blob = new Blob([file], { type: file.type })
      console.log(`Created blob for ${imageId}: size=${blob.size}, type=${blob.type}`)

      const storedImage: StoredImage = {
        id: imageId,
        filename: file.name,
        blob: blob,
        mimeType: file.type,
        size: file.size,
        uploadedAt: Date.now(),
        isTemporary: false, // Mark as permanent immediately since it's being used
        lastReferencedAt: Date.now(),
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(["images"], "readwrite")
        const store = transaction.objectStore("images")
        const request = store.add(storedImage)

        transaction.onerror = () =>
          reject(new Error("Failed to store image: " + (transaction.error?.message || "Unknown error")))

        request.onsuccess = () => {
          console.log(`Image stored successfully: ${imageId} (permanent)`)
          resolve(storedImage)
        }

        request.onerror = () =>
          reject(new Error("Failed to store image: " + (request.error?.message || "Unknown error")))
      })
    } finally {
      // Remove from pending after a longer delay
      setTimeout(() => {
        this.pendingImages.delete(imageId)
        console.log(`Removed ${imageId} from pending images`)
      }, 10000) // 10 seconds
    }
  }

  async markImageAsReferenced(id: string): Promise<void> {
    await this.init()

    if (!this.db) {
      throw new Error("Database not initialized")
    }

    console.log(`Marking image as referenced: ${id}`)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["images"], "readwrite")
      const store = transaction.objectStore("images")
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const image = getRequest.result
        if (image) {
          // Mark as no longer temporary and update reference time
          image.isTemporary = false
          image.lastReferencedAt = Date.now()

          const putRequest = store.put(image)
          putRequest.onsuccess = () => {
            console.log(`Image marked as referenced: ${id}`)
            resolve()
          }
          putRequest.onerror = () => reject(new Error("Failed to update image reference status"))
        } else {
          console.warn(`Image not found when marking as referenced: ${id}`)
          resolve()
        }
      }

      getRequest.onerror = () => reject(new Error("Failed to get image for reference update"))
    })
  }

  async getImage(id: string): Promise<StoredImage | null> {
    await this.init()

    if (!this.db) {
      throw new Error("Database not initialized")
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["images"], "readonly")
      const store = transaction.objectStore("images")
      const request = store.get(id)

      transaction.onerror = () =>
        reject(new Error("Failed to get image: " + (transaction.error?.message || "Unknown error")))

      request.onsuccess = () => {
        const result = request.result || null
        if (result) {
          console.log(`Image retrieved successfully: ${id} (size: ${result.blob.size}, type: ${result.blob.type})`)
        } else {
          console.warn(`Image not found: ${id}`)
        }
        resolve(result)
      }

      request.onerror = () => reject(new Error("Failed to get image: " + (request.error?.message || "Unknown error")))
    })
  }

  async getImageMetadata(id: string): Promise<ImageMetadata | null> {
    const image = await this.getImage(id)
    if (!image) return null

    return {
      id: image.id,
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.size,
      uploadedAt: image.uploadedAt,
      isTemporary: image.isTemporary,
      lastReferencedAt: image.lastReferencedAt,
    }
  }

  async createBlobUrl(id: string): Promise<string | null> {
    // Check cache first
    if (this.blobUrlCache.has(id)) {
      const cachedUrl = this.blobUrlCache.get(id)!
      console.log(`Using cached blob URL for ${id}: ${cachedUrl}`)
      return cachedUrl
    }

    try {
      console.log(`Creating new blob URL for image: ${id}`)
      const image = await this.getImage(id)
      if (!image) {
        console.warn(`Image not found for ID: ${id}`)
        return null
      }

      console.log(`Creating blob URL from blob: size=${image.blob.size}, type=${image.blob.type}`)
      const blobUrl = URL.createObjectURL(image.blob)
      this.blobUrlCache.set(id, blobUrl)

      // Mark image as referenced when blob URL is created
      await this.markImageAsReferenced(id)

      console.log(`Created blob URL for image: ${id} -> ${blobUrl}`)
      return blobUrl
    } catch (error) {
      console.error(`Failed to create blob URL for image ${id}:`, error)
      return null
    }
  }

  revokeBlobUrl(id: string): void {
    const blobUrl = this.blobUrlCache.get(id)
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      this.blobUrlCache.delete(id)
      console.log(`Revoked blob URL for image: ${id}`)
    }
  }

  revokeAllBlobUrls(): void {
    for (const [id, blobUrl] of this.blobUrlCache.entries()) {
      URL.revokeObjectURL(blobUrl)
      console.log(`Revoked blob URL for image: ${id}`)
    }
    this.blobUrlCache.clear()
  }

  async deleteImage(id: string): Promise<void> {
    await this.init()

    if (!this.db) {
      throw new Error("Database not initialized")
    }

    // Revoke blob URL if it exists
    this.revokeBlobUrl(id)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["images"], "readwrite")
      const store = transaction.objectStore("images")
      const request = store.delete(id)

      transaction.onerror = () =>
        reject(new Error("Failed to delete image: " + (transaction.error?.message || "Unknown error")))

      request.onsuccess = () => {
        console.log(`Image deleted successfully: ${id}`)
        resolve()
      }

      request.onerror = () =>
        reject(new Error("Failed to delete image: " + (request.error?.message || "Unknown error")))
    })
  }

  async getAllImages(): Promise<StoredImage[]> {
    await this.init()

    if (!this.db) {
      throw new Error("Database not initialized")
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["images"], "readonly")
      const store = transaction.objectStore("images")
      const request = store.getAll()

      transaction.onerror = () =>
        reject(new Error("Failed to get images: " + (transaction.error?.message || "Unknown error")))

      request.onsuccess = () => resolve(request.result)

      request.onerror = () => reject(new Error("Failed to get images: " + (request.error?.message || "Unknown error")))
    })
  }

  async getAllImageMetadata(): Promise<ImageMetadata[]> {
    const images = await this.getAllImages()
    return images.map((image) => ({
      id: image.id,
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.size,
      uploadedAt: image.uploadedAt,
      isTemporary: image.isTemporary,
      lastReferencedAt: image.lastReferencedAt,
    }))
  }

  // Utility method to extract image IDs from markdown content
  extractImageIds(content: string): string[] {
    const matches = content.match(/!\[([^\]]*)\]$$blob:([^)]+)$$/g) || []
    const imageIds = matches
      .map((match) => {
        const idMatch = match.match(/blob:([^)]+)/)
        return idMatch ? idMatch[1] : ""
      })
      .filter(Boolean)

    console.log(`Extracted ${imageIds.length} image IDs from content:`, imageIds)
    return imageIds
  }

  // Much more conservative cleanup - only delete truly orphaned images
  async cleanupUnusedImages(referencedImageIds: string[], force = false): Promise<number> {
    const allImages = await this.getAllImages()
    const referencedSet = new Set(referencedImageIds)
    const now = Date.now()
    let deletedCount = 0

    console.log(`Starting cleanup: ${allImages.length} total images, ${referencedImageIds.length} referenced`)

    for (const image of allImages) {
      // Skip if image is pending upload
      if (this.pendingImages.has(image.id)) {
        console.log(`Skipping pending image: ${image.id}`)
        continue
      }

      // Skip if image is referenced
      if (referencedSet.has(image.id)) {
        // Update reference time for referenced images
        await this.markImageAsReferenced(image.id)
        continue
      }

      // Much more conservative cleanup - only delete very old temporary images
      const shouldDelete = force || this.shouldDeleteImage(image, now)

      if (shouldDelete) {
        try {
          await this.deleteImage(image.id)
          deletedCount++
          console.log(`Cleaned up unused image: ${image.id}`)
        } catch (error) {
          console.error(`Failed to delete unused image ${image.id}:`, error)
        }
      } else {
        console.log(
          `Keeping image: ${image.id} (age: ${Math.round((now - image.uploadedAt) / 1000)}s, temp: ${image.isTemporary})`,
        )
      }
    }

    console.log(`Cleaned up ${deletedCount} unused images`)
    return deletedCount
  }

  private shouldDeleteImage(image: StoredImage, now: number): boolean {
    // Don't delete images uploaded within grace period (5 minutes)
    if (now - image.uploadedAt < this.CLEANUP_GRACE_PERIOD) {
      return false
    }

    // Don't delete images that were recently referenced (5 minutes)
    if (image.lastReferencedAt && now - image.lastReferencedAt < this.CLEANUP_GRACE_PERIOD) {
      return false
    }

    // Only delete temporary images that are very old
    return image.isTemporary === true
  }

  // Safe cleanup method that respects grace periods
  async safeCleanupUnusedImages(referencedImageIds: string[]): Promise<number> {
    return this.cleanupUnusedImages(referencedImageIds, false)
  }

  // Force cleanup method for manual cleanup
  async forceCleanupUnusedImages(referencedImageIds: string[]): Promise<number> {
    return this.cleanupUnusedImages(referencedImageIds, true)
  }

  close(): void {
    // Revoke all blob URLs to prevent memory leaks
    this.revokeAllBlobUrls()

    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
    }
  }
}

export const imageStorage = new ImageStorage()

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    imageStorage.close()
  })

  // Also cleanup on visibility change (when tab becomes hidden)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Only revoke blob URLs when tab is hidden, don't delete images
      imageStorage.revokeAllBlobUrls()
    }
  })
}
