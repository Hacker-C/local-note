"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

// Sample diary entries data - in a real app, this would come from a database or API
const diaryEntries = [
  {
    id: "1",
    title: "rrrr",
    content: "rrr",
    date: "June 11, 2025",
  },
  {
    id: "2",
    title: "wrerer",
    content: "ewewe",
    date: "June 11, 2025",
  },
  {
    id: "3",
    title: "A Sunny Afternoon",
    content:
      "The weather was great today, with sunshine streaming through the window, warm and cozy. I brewed a cup of herbal tea and read a favorite book. These small joys in life can always heal the heart. I hope every day can be as peaceful and beautiful as this moment. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    date: "June 11, 2025",
  },
]

export default function DiaryEntryPage() {
  const params = useParams()
  const entryId = params.id as string

  // Find the current entry
  const currentEntryIndex = diaryEntries.findIndex((entry) => entry.id === entryId)
  const currentEntry = diaryEntries[currentEntryIndex]

  // Determine previous and next entry IDs
  const prevEntryId = currentEntryIndex > 0 ? diaryEntries[currentEntryIndex - 1].id : null
  const nextEntryId = currentEntryIndex < diaryEntries.length - 1 ? diaryEntries[currentEntryIndex + 1].id : null

  // If entry not found, show a message
  if (!currentEntry) {
    return (
      <div className="min-h-screen bg-amber-50 p-6 flex items-center justify-center">
        <div className="max-w-4xl w-full mx-auto bg-white rounded-xl p-8 shadow-sm">
          <Link href="/">
            <Button variant="outline" className="mb-8">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
          <p className="text-center text-lg">Entry not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-amber-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl p-8 shadow-sm">
        <Link href="/">
          <Button variant="outline" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>

        <article className="space-y-4">
          <h1 className="text-4xl font-serif font-bold text-gray-800">{currentEntry.title}</h1>
          <p className="text-gray-500">{currentEntry.date}</p>

          <div className="mt-8 text-gray-700 leading-relaxed">
            <p>{currentEntry.content}</p>
          </div>
        </article>

        <Separator className="my-8" />

        <div className="flex justify-between">
          {prevEntryId ? (
            <Link href={`/entry/${prevEntryId}`}>
              <Button variant="outline" className="rounded-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous Story
              </Button>
            </Link>
          ) : (
            <div></div> // Empty div to maintain spacing when there's no previous entry
          )}

          {nextEntryId ? (
            <Link href={`/entry/${nextEntryId}`}>
              <Button variant="outline" className="rounded-full">
                Next Story <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div></div> // Empty div to maintain spacing when there's no next entry
          )}
        </div>
      </div>
    </div>
  )
}
