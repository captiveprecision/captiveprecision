"use client";

import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";

import { Badge, Button } from "@/components/ui";
import type { AppRole } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: Route;
  title: string;
  shortLabel: string;
};

type SidebarProps = {
  currentWorkspace: AppRole;
  availableWorkspaces: AppRole[];
  brandTitle?: string;
  brandSubtitle: string;
  brandLogoSrc?: string;
  brandLogoAlt?: string;
  navItems: NavItem[];
  toolItems?: NavItem[];
  footerTitle: string;
  footerCopy: string;
  footerMeta?: string;
  footerLinkLabel?: string;
  secondaryActionHref?: string;
  secondaryActionLabel?: string;
  logoutHref: string;
};

const workspaceLabel: Record<AppRole, string> = {
  admin: "Admin",
  coach: "Coach",
  gym: "Gym"
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
  currentWorkspace,
  availableWorkspaces,
  brandTitle = "Captive Precision",
  brandSubtitle,
  brandLogoSrc,
  brandLogoAlt = "Captive Precision mark",
  navItems,
  toolItems,
  footerTitle,
  footerCopy,
  footerMeta,
  footerLinkLabel,
  secondaryActionHref,
  secondaryActionLabel,
  logoutHref
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toolsActive = Boolean(toolItems?.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)));
  const [toolsOpen, setToolsOpen] = useState(toolsActive);
  const showWorkspaceSwitcher = availableWorkspaces.length > 1;

  useEffect(() => {
    if (toolsActive) {
      setToolsOpen(true);
    }
  }, [toolsActive]);

  const handleNavigate = () => setMobileOpen(false);
  const handleLogout = async () => {
    try {
      await fetch(logoutHref, { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  };

  const handleWorkspaceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextWorkspace = event.target.value as AppRole;
    if (!nextWorkspace || nextWorkspace === currentWorkspace) {
      return;
    }

    setMobileOpen(false);
    router.push(`/${nextWorkspace}` as Route);
  };
  const itemsBeforeTools = toolItems ? navItems.slice(0, 3) : navItems;
  const itemsAfterTools = toolItems ? navItems.slice(3) : [];

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mobile-menu-trigger"
        data-open={mobileOpen}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((value) => !value)}
      >
        Menu
      </Button>

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
              <span className="brand-mark">
                {brandLogoSrc ? (
                  <Image
                    src={brandLogoSrc}
                    alt={brandLogoAlt}
                    width={28}
                    height={28}
                    className="brand-mark__image"
                  />
                ) : (
                  "CP"
                )}
              </span>
              <div className="brand-copy">
                <p className="brand-title">{brandTitle}</p>
                <Badge variant="accent" className="brand-subtitle">
                  {brandSubtitle}
                </Badge>
              </div>
            </div>

            <div className="sidebar-top-actions">
              <div className="sidebar-top-separator" aria-hidden="true" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mobile-header-close"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <span className="sidebar-toggle-glyph" aria-hidden="true">
                  X
                </span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="sidebar-toggle"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <span className="sidebar-toggle-glyph" aria-hidden="true">
                  {collapsed ? ">" : "<"}
                </span>
              </Button>
            </div>
          </div>

          <div className="sidebar-divider" />

          {showWorkspaceSwitcher ? (
            <div className="sidebar-workspaces" aria-label="Workspace switcher">
              <span className="metric-label">Workspace access</span>
              <select
                className="ui-select sidebar-workspace-select"
                value={currentWorkspace}
                onChange={handleWorkspaceChange}
                aria-label="Switch workspace"
              >
                {availableWorkspaces.map((workspace) => (
                  <option key={workspace} value={workspace}>
                    {workspaceLabel[workspace]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

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
                  <span className="nav-bullet" aria-hidden="true">
                    L
                  </span>
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
              {footerMeta ? <p className="sidebar-footer-copy">{footerMeta}</p> : null}
              {footerLinkLabel ? <span className="sidebar-feedback-link">{footerLinkLabel}</span> : null}
            </div>
            {secondaryActionHref && secondaryActionLabel ? (
              <a
                href={secondaryActionHref}
                className={cn("ui-button", "ui-button--secondary", "ui-button--sm", "sidebar-secondary-action")}
              >
                {secondaryActionLabel}
              </a>
            ) : null}
            <button
              type="button"
              className={cn("ui-button", "ui-button--ghost", "ui-button--sm", "sidebar-logout")}
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
