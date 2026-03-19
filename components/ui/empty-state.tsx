import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("ui-empty-state", className)}>
      <h3 className="ui-empty-state__title">{title}</h3>
      {description ? <p className="ui-empty-state__description">{description}</p> : null}
      {action}
    </div>
  );
}
