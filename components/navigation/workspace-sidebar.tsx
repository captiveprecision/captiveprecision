"use client";

import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
  Wrench,
  X
} from "lucide-react";

import { Badge, Button } from "@/components/ui";
import type { AppRole } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: Route;
  title: string;
  icon: LucideIcon;
  children?: NavItem[];
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
  const Icon = item.icon;

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
        <Icon />
      </span>
      <span className="nav-title">{item.title}</span>
    </Link>
  );
}

function isItemActive(pathname: string, item: NavItem, index?: number) {
  if (typeof index === "number") {
    return isDashboardRoute(pathname, item.href, index);
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function isChildItemActive(pathname: string, item: NavItem, siblings: NavItem[]) {
  const hasMoreSpecificSibling = siblings.some((sibling) => (
    sibling.href !== item.href
    && sibling.href.startsWith(`${item.href}/`)
    && (pathname === sibling.href || pathname.startsWith(`${sibling.href}/`))
  ));

  if (hasMoreSpecificSibling) {
    return false;
  }

  return isItemActive(pathname, item);
}

function SidebarLinkGroup({
  item,
  active,
  open,
  collapsed,
  pathname,
  onToggle,
  onNavigate
}: {
  item: NavItem;
  active: boolean;
  open: boolean;
  collapsed: boolean;
  pathname: string;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <div className="sidebar-nav-group" data-open={open} data-collapsed={collapsed}>
      <button
        type="button"
        className="sidebar-link sidebar-nav-group-trigger"
        data-active={active}
        onClick={onToggle}
        aria-expanded={open}
        title={collapsed ? item.title : undefined}
      >
        <span className="nav-bullet" aria-hidden="true">
          <Icon />
        </span>
        <span className="nav-title">{item.title}</span>
        <span className="sidebar-tools-arrow" aria-hidden="true">
          {open ? <ChevronDown /> : <ChevronRight />}
        </span>
      </button>

      <div className="sidebar-submenu">
        {(item.children ?? []).map((child) => {
          const childActive = isChildItemActive(pathname, child, item.children ?? []);
          const ChildIcon = child.icon;

          return (
            <Link
              key={child.href}
              href={child.href}
              className="sidebar-sublink"
              data-active={childActive}
              onClick={onNavigate}
              title={collapsed ? child.title : undefined}
            >
              <span className="sidebar-sublink-bullet" aria-hidden="true">
                <ChildIcon />
              </span>
              <span>{child.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
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
  const [openNavGroups, setOpenNavGroups] = useState<Record<string, boolean>>({});
  const showWorkspaceSwitcher = availableWorkspaces.length > 1;
  const navGroupActiveKeys = useMemo(
    () => navItems
      .filter((item) => item.children?.length && (item.children.some((child) => isItemActive(pathname, child)) || isItemActive(pathname, item)))
      .map((item) => item.href),
    [navItems, pathname]
  );

  useEffect(() => {
    if (toolsActive) {
      setToolsOpen(true);
    }
  }, [toolsActive]);

  useEffect(() => {
    if (!navGroupActiveKeys.length) {
      return;
    }

    setOpenNavGroups((current) => {
      const next = { ...current };
      for (const key of navGroupActiveKeys) {
        next[key] = true;
      }
      return next;
    });
  }, [navGroupActiveKeys]);

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
  const renderNavItem = (item: NavItem, index?: number) => {
    const childActive = Boolean(item.children?.some((child) => isItemActive(pathname, child)));
    const active = childActive || isItemActive(pathname, item, index);

    if (item.children?.length) {
      const hasManualOpenState = Object.prototype.hasOwnProperty.call(openNavGroups, item.href);
      const open = hasManualOpenState ? Boolean(openNavGroups[item.href]) : active;

      return (
        <SidebarLinkGroup
          key={item.href}
          item={item}
          active={active}
          open={open}
          collapsed={collapsed}
          pathname={pathname}
          onNavigate={handleNavigate}
          onToggle={() => {
            if (collapsed) {
              setCollapsed(false);
              setOpenNavGroups((current) => ({ ...current, [item.href]: true }));
              return;
            }

            setOpenNavGroups((current) => ({ ...current, [item.href]: !open }));
          }}
        />
      );
    }

    return (
      <SidebarLink
        key={item.href}
        item={item}
        active={active}
        collapsed={collapsed}
        onNavigate={handleNavigate}
      />
    );
  };

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
        leadingIcon={<Menu />}
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
                iconOnly
                className="mobile-header-close"
                aria-label="Close menu"
                leadingIcon={<X />}
                onClick={() => setMobileOpen(false)}
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconOnly
                className="sidebar-toggle"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                leadingIcon={collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              />
            </div>
          </div>

          <div className="sidebar-divider" />

          {showWorkspaceSwitcher ? (
            <div className="sidebar-workspaces" aria-label="Workspace switcher">
              <span className="metric-label">Workspace Access</span>
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
            {itemsBeforeTools.map((item, index) => renderNavItem(item, index))}

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
                    <Wrench />
                  </span>
                  <span className="nav-title">Tools</span>
                  <span className="sidebar-tools-arrow" aria-hidden="true">
                    {toolsOpen ? <ChevronDown /> : <ChevronRight />}
                  </span>
                </button>

                <div className="sidebar-submenu">
                  {toolItems.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;

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
                          <Icon />
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {itemsAfterTools.map((item) => renderNavItem(item))}
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
                <span className="ui-button__label">{secondaryActionLabel}</span>
              </a>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="sidebar-logout"
              leadingIcon={<LogOut />}
              onClick={handleLogout}
            >
              Log Out
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
