'use client';

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import SignInButton from "../modules/auth/components/SignInButton";
import UserMenu from "../modules/auth/components/UserMenu";
import { useAuthStore } from "../modules/auth/authStore";

const navLinks = [
  { href: "/recipes", label: "My Recipes" },
  { href: "/browse", label: "Browse" },
  { href: "/calculators", label: "Calculators" },
  { href: "/learn", label: "Learn" },
] as const;

function NavLinkItem({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-[color-mix(in_oklch,var(--coral-600)_15%,transparent)] text-[var(--coral-600)]"
          : "text-[var(--fg-muted)] hover:text-[var(--fg-strong)] hover:bg-[color-mix(in_oklch,var(--fg-strong)_8%,transparent)]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function MobileNavLinkItem({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "block px-4 py-3 text-base font-medium transition-colors",
        isActive
          ? "bg-[color-mix(in_oklch,var(--coral-600)_12%,transparent)] text-[var(--coral-600)] border-l-2 border-[var(--coral-600)]"
          : "text-[var(--fg-muted)] hover:text-[var(--fg-strong)] hover:bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  // Close menu on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="relative top-0 z-50 border-b border-[rgb(var(--border))] bg-[var(--surface)]/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Logo />

          {/* Desktop navigation */}
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            {navLinks.map((link) => (
              <NavLinkItem key={link.href} href={link.href} label={link.label} />
            ))}
            <div className="ml-2 pl-2 border-l border-[rgb(var(--border))] flex items-center gap-2">
              <ThemeToggle />
              {!isAuthLoading && (user ? <UserMenu /> : <SignInButton />)}
            </div>
          </div>

          {/* Mobile menu button, auth, and theme toggle */}
          <div className="flex items-center gap-2 sm:hidden">
            {!isAuthLoading && (user ? <UserMenu /> : <SignInButton />)}
            <ThemeToggle />
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-strong)] hover:bg-[color-mix(in_oklch,var(--fg-strong)_8%,transparent)] transition-colors"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          ref={menuRef}
          id="mobile-menu"
          className="sm:hidden border-t border-[rgb(var(--border))] bg-[var(--surface)]"
        >
          <div className="py-2">
            {navLinks.map((link) => (
              <MobileNavLinkItem
                key={link.href}
                href={link.href}
                label={link.label}
                onClick={closeMobileMenu}
              />
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

