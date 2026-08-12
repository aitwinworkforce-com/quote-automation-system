import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, ShieldAlert } from "lucide-react";

export function BrandHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="text-xl font-extrabold tracking-[0.2em] text-primary"
            style={{ fontFamily: "Barlow, sans-serif" }}
          >
            OESTERGAARD
          </span>
          <span className="hidden rounded-sm border border-primary/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary sm:inline-block">
            AI Quote Agent
          </span>
        </Link>
        {isAuthenticated && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/audit">
                <ShieldAlert className="h-4 w-4" />
                <span className="hidden sm:inline">Audit Agent</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings/suppliers">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Suppliers</span>
              </Link>
            </Button>
            <span className="hidden text-sm text-muted-foreground md:inline">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
