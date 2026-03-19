import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type BadgeVariant = "neutral" | "accent" | "subtle" | "dark";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return <span className={cn("ui-badge", variant !== "neutral" && `ui-badge--${variant}`, className)} {...props} />;
}
