import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type TabItem<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export type TabsProps<T extends string> = {
  items: Array<TabItem<T>>;
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
  ariaLabel?: string;
};

export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  className,
  listClassName,
  triggerClassName,
  ariaLabel
}: TabsProps<T>) {
  return (
    <div className={cn("ui-tabs", className)}>
      <div className={cn("ui-tabs-list", listClassName)} role="tablist" aria-label={ariaLabel}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            className={cn("ui-tabs-trigger", triggerClassName)}
            data-active={item.value === value}
            aria-selected={item.value === value}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
