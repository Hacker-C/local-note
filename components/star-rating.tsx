"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  rating: number
  onRatingChange?: (rating: number) => void
  readonly?: boolean
  size?: "sm" | "md" | "lg"
}

export function StarRating({ rating, onRatingChange, readonly = false, size = "md" }: StarRatingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }

  const handleStarClick = (starIndex: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(starIndex + 1)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => handleStarClick(index)}
          disabled={readonly}
          className={cn(
            "transition-colors",
            !readonly && "hover:scale-110 cursor-pointer",
            readonly && "cursor-default",
          )}
        >
          <Star
            className={cn(
              sizeClasses[size],
              index < rating ? "fill-yellow-400 text-yellow-400" : "fill-none text-gray-300 hover:text-yellow-400",
            )}
          />
        </button>
      ))}
    </div>
  )
}
