"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { notesDB } from "@/lib/db"

export type Theme = "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "black"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  loading: boolean
  error: string | null
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("yellow")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load theme from IndexedDB on initial render
  useEffect(() => {
    let mounted = true

    const loadTheme = async () => {
      try {
        // Try to get theme from localStorage first as fallback
        const localTheme = localStorage.getItem("theme")
        if (localTheme && isValidTheme(localTheme)) {
          setTheme(localTheme)
        }

        // Then try to load from IndexedDB
        try {
          await notesDB.init()
          const savedTheme = await notesDB.getSetting("theme")
          if (mounted && savedTheme && isValidTheme(savedTheme)) {
            setTheme(savedTheme)
            // Sync with localStorage
            localStorage.setItem("theme", savedTheme)
          }
        } catch (dbError) {
          console.warn("Failed to load theme from database, using localStorage fallback:", dbError)
          // Database error, but we can still use localStorage
        }
      } catch (error) {
        console.error("Failed to load theme:", error)
        setError("Failed to load theme settings")
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadTheme()

    return () => {
      mounted = false
    }
  }, [])

  // Save theme to both IndexedDB and localStorage
  useEffect(() => {
    if (loading) return

    const saveAndApplyTheme = async () => {
      try {
        // Always save to localStorage for immediate fallback
        localStorage.setItem("theme", theme)

        // Try to save to IndexedDB
        try {
          await notesDB.setSetting("theme", theme)
        } catch (dbError) {
          console.warn("Failed to save theme to database:", dbError)
          // Not critical, localStorage will work as fallback
        }
      } catch (error) {
        console.error("Failed to save theme:", error)
        setError("Failed to save theme settings")
      }

      // Apply theme class to document root
      const root = document.documentElement

      // Remove existing theme classes
      root.classList.remove(
        "theme-red",
        "theme-orange",
        "theme-yellow",
        "theme-green",
        "theme-cyan",
        "theme-blue",
        "theme-purple",
        "theme-black",
      )

      // Add new theme class
      root.classList.add(`theme-${theme}`)

      // Ensure body has transition properties
      document.body.style.transition = "background-color 300ms ease-in-out, color 300ms ease-in-out"
    }

    saveAndApplyTheme()
  }, [theme, loading])

  const handleSetTheme = (newTheme: Theme) => {
    setError(null)
    setTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, loading, error }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Helper function to validate theme values
function isValidTheme(theme: string): theme is Theme {
  return ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "black"].includes(theme)
}

// Custom hook to use the theme context
export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
