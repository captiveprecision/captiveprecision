"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  {
    href: "/" as Route,
    title: "Dashboard",
    shortLabel: "D"
  },
  {
    href: "/my-teams" as Route,
    title: "My Teams",
    shortLabel: "T"
  },
  {
    href: "/profile" as Route,
    title: "Profile",
    shortLabel: "P"
  },
  {
    href: "/messages" as Route,
    title: "Messages",
    shortLabel: "M"
  },
  {
    href: "/events" as Route,
    title: "Events",
    shortLabel: "E"
  },
  {
    href: "/settings" as Route,
    title: "Settings",
    shortLabel: "S"
  }
];

const toolItems = [
  {
    href: "/tools/cheer-score-calculator" as Route,
    title: "Cheer Score",
    shortLabel: "C"
  },
  {
    href: "/tools/full-out-evaluator" as Route,
    title: "Full Out Evaluator",
    shortLabel: "F"
  },
  {
    href: "/tools/cheer-planner" as Route,
    title: "Cheer Planner",
    shortLabel: "P"
  }
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toolsActive = pathname === "/tools" || pathname.startsWith("/tools/");
  const [toolsOpen, setToolsOpen] = useState(toolsActive);

  useEffect(() => {
    if (toolsActive) {
      setToolsOpen(true);
    }
  }, [toolsActive]);

  return (
    <>
      <button
        type="button"
        className="mobile-menu-trigger"
        data-open={mobileOpen}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((value) => !value)}
      >
        Menu
      </button>

      <div
        className="mobile-menu-overlay"
        data-open={mobileOpen}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />

      <aside className="sidebar" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
        <div className="sidebar-panel">
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <span className="brand-mark">CP</span>
              <div className="brand-copy">
                <p className="brand-title">Captive Precision</p>
                <p className="brand-subtitle">Premium cheer tools</p>
              </div>
            </div>

            <div className="sidebar-top-actions">
              <div className="sidebar-top-separator" aria-hidden="true" />
              <button
                type="button"
                className="mobile-header-close"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <span className="sidebar-toggle-glyph" aria-hidden="true">X</span>
              </button>

              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <span className="sidebar-toggle-glyph" aria-hidden="true">
                  {collapsed ? ">" : "<"}
                </span>
              </button>
            </div>
          </div>

          <div className="sidebar-divider" />

          <nav className="sidebar-group" aria-label="Main navigation">
            {navItems.slice(0, 3).map((item) => {
              const active = item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="sidebar-link"
                  data-active={active}
                  onClick={() => setMobileOpen(false)}
                  aria-label={item.title}
                  title={collapsed ? item.title : undefined}
                >
                  <span className="nav-bullet" aria-hidden="true">
                    {item.shortLabel}
                  </span>
                  <span className="nav-title">{item.title}</span>
                </Link>
              );
            })}

            <div className="sidebar-tools-group" data-open={toolsOpen} data-collapsed={collapsed}>
              <button
                type="button"
                className="sidebar-link sidebar-tools-trigger"
                data-active={toolsActive}
                onClick={() => {
                  if (collapsed) {
                    setCollapsed(false);
                    setToolsOpen(true);
                    return;
                  }

                  setToolsOpen((value) => !value);
                }}
                aria-expanded={toolsOpen}
                title={collapsed ? "Tools" : undefined}
              >
                <span className="nav-bullet" aria-hidden="true">L</span>
                <span className="nav-title">Tools</span>
                <span className="sidebar-tools-arrow" aria-hidden="true">
                  {toolsOpen ? "-" : "+"}
                </span>
              </button>

              <div className="sidebar-submenu">
                {toolItems.map((item) => {
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="sidebar-sublink"
                      data-active={active}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.title : undefined}
                    >
                      <span className="sidebar-sublink-bullet" aria-hidden="true">
                        {item.shortLabel}
                      </span>
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {navItems.slice(3).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="sidebar-link"
                  data-active={active}
                  onClick={() => setMobileOpen(false)}
                  aria-label={item.title}
                  title={collapsed ? item.title : undefined}
                >
                  <span className="nav-bullet" aria-hidden="true">
                    {item.shortLabel}
                  </span>
                  <span className="nav-title">{item.title}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-footer-card">
              <p className="sidebar-footer-title">Current release</p>
              <p className="sidebar-footer-copy">
                The first production module is the cheer score calculator. The rest of the app will follow this same visual system.
              </p>
            </div>
            <button type="button" className="sidebar-logout">
              Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
