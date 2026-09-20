import type { InputHTMLAttributes } from "react";

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  error?: boolean;
};

export function FormField({
  id, label, error = false, className = "", ...props
}: FormFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <input
        {...props}
        id={id}
        aria-invalid={error || undefined}
        className={["field__input", className].filter(Boolean).join(" ")}
      />
    </div>
  );
}
