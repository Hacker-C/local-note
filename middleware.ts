import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle /note/new route explicitly to prevent it from being caught by [id]
  if (pathname === "/note/new") {
    // Allow the request to continue to the specific route
    return NextResponse.next()
  }

  // Validate dynamic note routes
  if (pathname.startsWith("/note/") && pathname !== "/note/new") {
    const noteId = pathname.split("/note/")[1]

    // Check if the ID is a reserved word
    const reservedWords = ["new", "create", "add", "edit"]
    if (reservedWords.includes(noteId.toLowerCase())) {
      // Redirect reserved words to appropriate routes
      if (noteId.toLowerCase() === "new") {
        return NextResponse.redirect(new URL("/note/new", request.url))
      }
      // For other reserved words, redirect to home
      return NextResponse.redirect(new URL("/", request.url))
    }

    // Validate that the ID looks like a valid note ID
    // Note IDs should follow the pattern: note_timestamp_randomstring
    if (!noteId.match(/^note_\d+_[a-z0-9]+$/i) && noteId !== "new") {
      // If it doesn't match the expected pattern, it might be invalid
      // Let the component handle the "not found" case
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/note/:path*"],
}
