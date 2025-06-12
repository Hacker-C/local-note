"use client"

interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className={`text-center py-4 text-sm text-theme-text-muted transition-colors duration-300 ${className || ""}`}
    >
      @MurphyChen {currentYear}
    </footer>
  )
}
