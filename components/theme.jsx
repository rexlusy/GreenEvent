"use client";

import { useSyncExternalStore } from "react";

const media = "(prefers-color-scheme: dark)";
const themeKey = "greenevent.theme";

function subscribe(update) {
  const query = window.matchMedia(media);
  query.addEventListener("change", update);
  window.addEventListener("greenevent-theme", update);
  return () => {
    query.removeEventListener("change", update);
    window.removeEventListener("greenevent-theme", update);
  };
}

function currentTheme() {
  return document.documentElement.dataset.theme || (window.matchMedia(media).matches ? "dark" : "light");
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => null);
  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(themeKey, next); } catch {}
    window.dispatchEvent(new Event("greenevent-theme"));
  }
  return <button type="button" className="theme-toggle" onClick={toggle} aria-pressed={theme === "dark"} aria-label="Mode gelap">
    <span className="theme-icon" aria-hidden="true" />
  </button>;
}
