import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, containerClassName, label, hint, error, id, ...props },
  ref
) {
  return (
    <div className={cn("ui-field", containerClassName)}>
      {label ? <label className="ui-field__label" htmlFor={id}>{label}</label> : null}
      <input ref={ref} id={id} className={cn("ui-input", className)} {...props} />
      {error ? <p className="ui-field__error">{error}</p> : hint ? <p className="ui-field__hint">{hint}</p> : null}
    </div>
  );
});
