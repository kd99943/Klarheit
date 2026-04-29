import { cn } from "../../lib/utils";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  className?: string;
  inputClassName?: string;
}

export function FormField({ label, className, inputClassName, ...inputProps }: FormFieldProps) {
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
    </div>
  );
}
