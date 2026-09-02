"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { clearSession } from "@/lib/session";

const nav = [
  { href: "/home", label: "Home" },
  { href: "/measurements", label: "인바디" },
  { href: "/weight", label: "체중" },
  { href: "/charts", label: "추이" },
  { href: "/notice", label: "Notice" },
  { href: "/inquiries", label: "Q&A" },
  { href: "/my", label: "My" },
];

const otherApps = [
  { name: "SnapWord", iconUrl: "/snapword-link-icon.png", href: "https://snapword.myjane.co.kr/home" },
  { name: "SnapNote", iconUrl: "/snapnote-link-icon.png", href: "https://snapnote.myjane.co.kr/home" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [appMenu, setAppMenu] = useState(false);
  const appMenuRef = useRef<HTMLDivElement>(null);

  const logout = () => {
    clearSession();
    router.replace("/");
  };

  useEffect(() => {
    if (!appMenu) return;
    const onClick = (e: MouseEvent) => {
      if (appMenuRef.current && !appMenuRef.current.contains(e.target as Node)) {
        setAppMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [appMenu]);

  return (
    <>
      {open && (
        <div className="topnav-backdrop" onClick={() => setOpen(false)} />
      )}

      <nav className={`topnav ${open ? "topnav--open" : ""}`}>
        <div className="topnav-bar">
          <div className="topnav-logo-wrap" ref={appMenuRef}>
            <button
              type="button"
              className="topnav-logo"
              onClick={() => setAppMenu((v) => !v)}
            >
              <AppIcon size={28} alt="" priority className="topnav-logo-icon" />
              <span style={{ fontStyle: "italic", fontWeight: 900 }}>SnapWord</span>
              <ChevronIcon open={appMenu} />
            </button>
            {appMenu && (
              <div className="app-switcher">
                {otherApps.map((app) => (
                  <a
                    key={app.name}
                    href={app.href}
                    className="app-switcher-item"
                    onClick={() => setAppMenu(false)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={app.iconUrl} alt={app.name} width={28} height={28} className="app-switcher-icon" />
                    <span style={{ fontStyle: "italic", fontWeight: 900 }}>{app.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="topnav-links">
            {nav.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link key={href} href={href} className="topnav-link" data-active={active}>
                  {label}
                </Link>
              );
            })}
            <button type="button" onClick={logout} className="topnav-logout">
              Logout
            </button>
          </div>

          <button
            type="button"
            className={`topnav-hamburger ${open ? "topnav-hamburger--open" : ""}`}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            data-guide="hamburger-btn"
          >
            <span className="topnav-hamburger-line topnav-hamburger-line--1" />
            <span className="topnav-hamburger-line topnav-hamburger-line--2" />
            <span className="topnav-hamburger-line topnav-hamburger-line--3" />
          </button>
        </div>

        <div className="topnav-menu">
          {nav.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className="topnav-menu-link"
                data-active={active}
                onClick={() => setOpen(false)}
                {...(href === "/folders" ? { "data-guide": "menu-folders" } : {})}
              >
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => { setOpen(false); logout(); }}
            className="topnav-logout topnav-menu-logout"
          >
            Logout
          </button>
        </div>
      </nav>
    </>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0, position: "relative", top: 2 }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
