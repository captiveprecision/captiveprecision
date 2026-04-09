import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type ButtonLinkVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonLinkSize = "sm" | "md" | "lg";

export type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonLinkVariant;
  size?: ButtonLinkSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  iconOnly?: boolean;
};

export function ButtonLink({
  children,
  className,
  variant = "primary",
  size = "md",
  leadingIcon,
  trailingIcon,
  iconOnly = false,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "ui-button",
        `ui-button--${variant}`,
        size !== "md" && `ui-button--${size}`,
        iconOnly && "ui-button--icon-only",
        className
      )}
      {...props}
    >
      {leadingIcon ? (
        <span className="ui-button__icon" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      {children ? <span className="ui-button__label">{children}</span> : null}
      {trailingIcon ? (
        <span className="ui-button__icon" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </Link>
  );
}
