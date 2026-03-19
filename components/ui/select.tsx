import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, className, containerClassName, label, hint, error, id, placeholder, ...props },
  ref
) {
  return (
    <div className={cn("ui-field", containerClassName)}>
      {label ? <label className="ui-field__label" htmlFor={id}>{label}</label> : null}
      <select ref={ref} id={id} className={cn("ui-select", className)} {...props}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children}
      </select>
      {error ? <p className="ui-field__error">{error}</p> : hint ? <p className="ui-field__hint">{hint}</p> : null}
    </div>
  );
});
