import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function SectionHeader({
  className,
  eyebrow,
  title,
  description,
  actions,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn("ui-section-header", className)} {...props}>
      <div className="ui-section-header__copy">
        {eyebrow ? <span className="ui-section-header__eyebrow">{eyebrow}</span> : null}
        <h2 className="ui-section-header__title">{title}</h2>
        {description ? <p className="ui-section-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-section-header__actions">{actions}</div> : null}
    </div>
  );
}
