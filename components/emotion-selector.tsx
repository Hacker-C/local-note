"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Smile, Meh, Laugh, Frown, CloudRain, Angry } from "lucide-react"

export type Emotion = "Calm" | "Happy" | "Funny" | "Depressed" | "Sad" | "Angry"

interface EmotionSelectorProps {
  selectedEmotion: Emotion
  onEmotionChange?: (emotion: Emotion) => void
  readonly?: boolean
  size?: "sm" | "md" | "lg"
}

const emotions = [
  {
    value: "Calm" as Emotion,
    label: "Calm",
    icon: Meh,
    color: "text-blue-600 dark:text-blue-400",
    bgColor:
      "bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-800/30 dark:border-blue-700",
  },
  {
    value: "Happy" as Emotion,
    label: "Happy",
    icon: Smile,
    color: "text-green-600 dark:text-green-400",
    bgColor:
      "bg-green-50 hover:bg-green-100 border-green-200 dark:bg-green-900/20 dark:hover:bg-green-800/30 dark:border-green-700",
  },
  {
    value: "Funny" as Emotion,
    label: "Funny",
    icon: Laugh,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor:
      "bg-yellow-50 hover:bg-yellow-100 border-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-800/30 dark:border-yellow-700",
  },
  {
    value: "Depressed" as Emotion,
    label: "Depressed",
    icon: CloudRain,
    color: "text-gray-600 dark:text-gray-300",
    bgColor:
      "bg-gray-50 hover:bg-gray-100 border-gray-200 dark:bg-gray-800/50 dark:hover:bg-gray-700/50 dark:border-gray-600",
  },
  {
    value: "Sad" as Emotion,
    label: "Sad",
    icon: Frown,
    color: "text-blue-700 dark:text-blue-300",
    bgColor:
      "bg-blue-50 hover:bg-blue-100 border-blue-300 dark:bg-blue-900/20 dark:hover:bg-blue-800/30 dark:border-blue-600",
  },
  {
    value: "Angry" as Emotion,
    label: "Angry",
    icon: Angry,
    color: "text-red-600 dark:text-red-400",
    bgColor:
      "bg-red-50 hover:bg-red-100 border-red-200 dark:bg-red-900/20 dark:hover:bg-red-800/30 dark:border-red-700",
  },
]

export function EmotionSelector({
  selectedEmotion,
  onEmotionChange,
  readonly = false,
  size = "md",
}: EmotionSelectorProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-2",
    lg: "text-base px-4 py-3",
  }

  const iconSizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  if (readonly) {
    const emotion = emotions.find((e) => e.value === selectedEmotion)
    if (!emotion) return null

    const Icon = emotion.icon
    return (
      <div className="flex items-center gap-2">
        <Icon className={cn(iconSizeClasses[size], emotion.color)} />
        <span className={cn("font-medium", emotion.color)}>{emotion.label}</span>
      </div>
    )
  }

  const gridCols = size === "sm" ? "grid-cols-2" : "grid-cols-3"

  return (
    <div className={cn("grid gap-2", gridCols)}>
      {emotions.map((emotion) => {
        const Icon = emotion.icon
        const isSelected = selectedEmotion === emotion.value

        return (
          <Button
            key={emotion.value}
            type="button"
            variant="outline"
            onClick={() => onEmotionChange?.(emotion.value)}
            className={cn(
              sizeClasses[size],
              "flex items-center gap-2 transition-all border-2",
              isSelected
                ? cn(emotion.bgColor, emotion.color, "font-medium")
                : "hover:bg-theme-card-accent border-theme-border text-theme-text hover:text-theme-text",
            )}
          >
            <Icon className={cn(iconSizeClasses[size], isSelected ? emotion.color : "text-theme-text-muted")} />
            <span className={cn(isSelected ? emotion.color : "text-theme-text")}>{emotion.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
