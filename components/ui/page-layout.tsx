import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

import { Card, CardContent, type CardProps } from "./card";
import { SectionHeader, type SectionHeaderProps } from "./section-header";

type PageHeroProps = Omit<SectionHeaderProps, "className"> & {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  cardVariant?: CardProps["variant"];
};

export function PageHero({
  children,
  className,
  contentClassName,
  cardVariant = "default",
  ...headerProps
}: PageHeroProps) {
  return (
    <Card radius="panel" variant={cardVariant} className={cn("ui-page-hero", className)}>
      <CardContent className={cn("ui-page-hero__content", contentClassName)}>
        <SectionHeader {...headerProps} />
        {children}
      </CardContent>
    </Card>
  );
}

export function PageColumns({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("ui-page-columns", className)} {...props} />;
}

export function PageMainColumn({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-page-main", className)} {...props} />;
}

export function PageSideColumn({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <aside className={cn("ui-page-side", className)} {...props} />;
}

export function DetailGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-detail-grid", className)} {...props} />;
}

export function StatGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-stat-grid", className)} {...props} />;
}

export function FormShell({ className, contentClassName, children, ...props }: CardProps & { contentClassName?: string }) {
  return (
    <Card radius="panel" className={cn("ui-form-shell", className)} {...props}>
      <CardContent className={cn("ui-form-shell__content", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
