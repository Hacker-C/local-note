"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Palette, Check } from "lucide-react"
import { useTheme, type Theme } from "@/components/theme-provider"

const themes: Array<{ value: Theme; label: string; color: string }> = [
  { value: "red", label: "Red", color: "bg-red-500" },
  { value: "orange", label: "Orange", color: "bg-orange-500" },
  { value: "yellow", label: "Yellow", color: "bg-yellow-500" },
  { value: "green", label: "Green", color: "bg-green-500" },
  { value: "cyan", label: "Cyan", color: "bg-cyan-500" },
  { value: "blue", label: "Blue", color: "bg-blue-500" },
  { value: "purple", label: "Purple", color: "bg-purple-500" },
  { value: "black", label: "Dark", color: "bg-gray-900" },
]

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-theme-border bg-theme-card text-theme-text hover:bg-theme-card-accent transition-colors duration-300"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32 bg-theme-card border-theme-border shadow-lg">
        {themes.map((themeOption) => (
          <DropdownMenuItem
            key={themeOption.value}
            onClick={() => setTheme(themeOption.value)}
            className="flex items-center justify-between cursor-pointer text-theme-text hover:bg-theme-card-accent transition-colors duration-200"
          >
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${themeOption.color} border border-theme-border`} />
              <span>{themeOption.label}</span>
            </div>
            {theme === themeOption.value && <Check className="h-4 w-4 text-theme-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
