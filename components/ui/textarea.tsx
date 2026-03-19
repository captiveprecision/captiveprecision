import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, containerClassName, label, hint, error, id, rows = 4, ...props },
  ref
) {
  return (
    <div className={cn("ui-field", containerClassName)}>
      {label ? <label className="ui-field__label" htmlFor={id}>{label}</label> : null}
      <textarea ref={ref} id={id} rows={rows} className={cn("ui-textarea", className)} {...props} />
      {error ? <p className="ui-field__error">{error}</p> : hint ? <p className="ui-field__hint">{hint}</p> : null}
    </div>
  );
});
