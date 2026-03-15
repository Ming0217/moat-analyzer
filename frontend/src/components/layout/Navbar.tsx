import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useTheme } from "@/hooks/useTheme"
import { Sun, Moon, Compass, CircleUserRound } from "lucide-react"
import { CastleIcon } from "@/components/icons/CastleIcon"
import { ProfilePanel } from "@/components/layout/ProfilePanel"

export function Navbar() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <header className="border-b bg-background relative" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-foreground">
            <CastleIcon className="h-10 w-10 shrink-0" />
            <span className="hidden sm:inline">MoatAnalyzer</span>
          </Link>

          <div className="flex items-center gap-1">
            {user && (
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                <Link to="/methodology">
                  <Compass className="h-5 w-5" />
                  <span className="hidden sm:inline ml-1.5">Methodology</span>
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="text-muted-foreground hover:text-foreground">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Profile"
                onClick={() => setProfileOpen(o => !o)}
                className={profileOpen ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}
              >
                <CircleUserRound className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}
    </header>
  )
}
