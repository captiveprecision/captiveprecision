"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: Route;
  title: string;
  shortLabel: string;
};

type SidebarProps = {
  brandSubtitle: string;
  navItems: NavItem[];
  toolItems?: NavItem[];
  footerTitle: string;
  footerCopy: string;
  logoutHref: string;
};

function isDashboardRoute(pathname: string, href: string, index: number) {
  if (index !== 0) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return pathname === href;
}

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      className="sidebar-link"
      data-active={active}
      onClick={onNavigate}
      aria-label={item.title}
      title={collapsed ? item.title : undefined}
    >
      <span className="nav-bullet" aria-hidden="true">
        {item.shortLabel}
      </span>
      <span className="nav-title">{item.title}</span>
    </Link>
  );
}

export function WorkspaceSidebar({
  brandSubtitle,
  navItems,
  toolItems,
  footerTitle,
  footerCopy,
  logoutHref
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toolsActive = Boolean(toolItems?.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)));
  const [toolsOpen, setToolsOpen] = useState(toolsActive);

  useEffect(() => {
    if (toolsActive) {
      setToolsOpen(true);
    }
  }, [toolsActive]);

  const handleNavigate = () => setMobileOpen(false);
  const itemsBeforeTools = toolItems ? navItems.slice(0, 3) : navItems;
  const itemsAfterTools = toolItems ? navItems.slice(3) : [];

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
                <p className="brand-subtitle">{brandSubtitle}</p>
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
            {itemsBeforeTools.map((item, index) => (
              <SidebarLink
                key={item.href}
                item={item}
                active={isDashboardRoute(pathname, item.href, index)}
                collapsed={collapsed}
                onNavigate={handleNavigate}
              />
            ))}

            {toolItems ? (
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
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="sidebar-sublink"
                        data-active={active}
                        onClick={handleNavigate}
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
            ) : null}

            {itemsAfterTools.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={active}
                  collapsed={collapsed}
                  onNavigate={handleNavigate}
                />
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-footer-card">
              <p className="sidebar-footer-title">{footerTitle}</p>
              <p className="sidebar-footer-copy">{footerCopy}</p>
            </div>
            <a href={logoutHref} className="sidebar-logout">
              Log out
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
