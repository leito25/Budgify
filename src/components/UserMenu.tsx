import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SessionUser } from "../auth/supabase-auth";
import type { TranslationKey } from "../i18n";
import type { Theme } from "../storage/model";
import { personLabel } from "./AuditNote";

const THEMES: { value: Theme; label: TranslationKey }[] = [
  { value: "light", label: "theme.light" },
  { value: "dark", label: "theme.dark" },
  { value: "system", label: "theme.system" },
];

/** Initials from the name, or from the email when there is no name. */
export function initialsFor(user: SessionUser): string {
  const source = user.name?.trim() || user.email.split("@")[0];
  const words = source.split(/[\s._+-]+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0]);
  return (letters.join("") || "?").toLocaleUpperCase();
}

interface UserMenuProps {
  user: SessionUser;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onSignOut: () => void;
  t: (key: TranslationKey) => string;
}

export function UserMenu({
  user,
  theme,
  onTheme,
  onSignOut,
  t,
}: UserMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [
      ...(panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ??
        []),
    ];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(items.length - 1);
    else if (event.key === "Tab") setOpen(false);
  }

  return (
    <div className="user-menu" ref={root}>
      <button
        ref={button}
        type="button"
        className="user-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{initialsFor(user)}</span>
        <span className="sr-only">{t("menu.label")}</span>
      </button>
      {open && (
        <div
          id={menuId}
          ref={panel}
          className="user-menu-panel"
          role="menu"
          tabIndex={-1}
          aria-label={t("menu.label")}
          onKeyDown={onMenuKeyDown}
        >
          <p className="user-menu-person">{personLabel(user)}</p>
          <div role="group" aria-label={t("menu.theme")}>
            <p className="user-menu-heading" aria-hidden="true">
              {t("menu.theme")}
            </p>
            {THEMES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === option.value}
                tabIndex={-1}
                onClick={() => onTheme(option.value)}
              >
                <span aria-hidden="true" className="user-menu-mark">
                  {theme === option.value ? "✓" : ""}
                </span>
                {t(option.label)}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            {t("nav.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
