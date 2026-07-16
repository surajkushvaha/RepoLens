"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemes>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={`flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground ${className}`}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  );
}
