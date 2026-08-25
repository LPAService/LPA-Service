"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "lpa-leo-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const resolved = stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    setTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      aria-label={theme === "dark" ? "Trocar para tema claro" : "Trocar para tema escuro"}
      aria-pressed={theme === "dark"}
      className="theme-toggle"
      onClick={toggle}
      title={theme === "dark" ? "Trocar para tema claro" : "Trocar para tema escuro"}
      type="button"
    >
      {theme === "dark" ? "☀️" : "🌙"}
      <span className="sr-only">Alternar tema</span>
    </button>
  );
}