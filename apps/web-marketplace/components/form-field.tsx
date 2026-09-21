import type { InputHTMLAttributes } from "react";

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  error?: boolean;
  errorMessage?: string;
};

export function FormField({
  id, label, error = false, errorMessage,
  className = "", "aria-describedby": describedBy, ...props
}: FormFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <input
        {...props}
        id={id}
        aria-invalid={error || Boolean(errorMessage) || undefined}
        aria-describedby={[
          describedBy, errorMessage && `${id}-error`,
        ].filter(Boolean).join(" ") || undefined}
        className={["field__input", className].filter(Boolean).join(" ")}
      />
      {errorMessage && (
        <p className="field__error" id={`${id}-error`}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
