import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

type CardVariant = "default" | "subtle" | "dark";
type CardRadius = "card" | "panel";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  radius?: CardRadius;
};

export function Card({ className, variant = "default", radius = "card", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "ui-card",
        variant !== "default" && `ui-card--${variant}`,
        radius === "panel" && "ui-card--panel",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-card__header", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("ui-card__title", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ui-card__description", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-card__content", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-card__footer", className)} {...props} />;
}
