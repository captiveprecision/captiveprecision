import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

type ButtonLinkVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonLinkSize = "sm" | "md" | "lg";

export type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonLinkVariant;
  size?: ButtonLinkSize;
};

export function ButtonLink({ className, variant = "primary", size = "md", ...props }: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "ui-button",
        `ui-button--${variant}`,
        size !== "md" && `ui-button--${size}`,
        className
      )}
      {...props}
    />
  );
}
