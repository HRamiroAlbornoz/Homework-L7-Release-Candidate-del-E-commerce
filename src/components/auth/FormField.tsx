interface FormFieldProps {
  id: string;
  label: string;
  type: "email" | "password" | "text";
  value: string;
  onChange: (value: string) => void;
  // "| undefined" explícito (no solo "?"): con exactOptionalPropertyTypes,
  // el resultado de Zod (issues.campo?.[0]) es "string | undefined", y este
  // componente recibe ese valor directo sin filtrar el caso "undefined".
  error?: string | undefined;
  disabled?: boolean;
  autoComplete?: string;
}

// Input reutilizable para los formularios de auth (LoginForm, SignupForm):
// accesibilidad (label asociado, aria-describedby/aria-invalid/aria-required)
// resuelta una sola vez acá, en vez de repetirla campo por campo.
export function FormField({ id, label, type, value, onChange, error, disabled, autoComplete }: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="form-field">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        autoComplete={autoComplete}
        className="form-field__input"
      />
      {error && (
        <span id={errorId} role="alert" className="form-field__error">
          {error}
        </span>
      )}
    </div>
  );
}
