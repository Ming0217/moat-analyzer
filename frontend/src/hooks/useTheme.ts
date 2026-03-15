import { useEffect, useState } from "react"

type Theme = "light" | "dark"

function getInitial(): Theme {
  if (typeof window === "undefined") return "light"
  const stored = localStorage.getItem("theme") as Theme | null
  if (stored) return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial)

  useEffect(() => {
    apply(theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  // Apply on mount to avoid flash
  useEffect(() => { apply(getInitial()) }, [])

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark")

  return { theme, toggle }
}
