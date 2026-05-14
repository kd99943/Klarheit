import type { ChangeEventHandler } from "react";
import { cn } from "../../lib/utils";

type FormFieldProps = {
  label: string;
  className?: string;
  inputClassName?: string;
  hint?: string;
  type?: string;
  defaultValue?: string;
  name?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  placeholder?: string;
  readOnly?: boolean;
};

export function FormField({ label, className, inputClassName, hint, ...inputProps }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2 relative group", className)}>
      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
        {label}
      </label>
      <input
        className={cn(
          "w-full bg-transparent border-0 border-b border-slate-200 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-xl font-medium font-mono text-brand-primary rounded-none",
          inputClassName
        )}
        {...inputProps}
      />
      {hint ? <p className="text-xs text-slate-400 font-light">{hint}</p> : null}
    </div>
  );
}
