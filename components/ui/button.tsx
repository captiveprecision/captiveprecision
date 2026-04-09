import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  iconOnly?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    variant = "primary",
    size = "md",
    type = "button",
    leadingIcon,
    trailingIcon,
    iconOnly = false,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
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
    </button>
  );
});
