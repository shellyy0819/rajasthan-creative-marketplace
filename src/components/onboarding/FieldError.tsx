/** Shared inline error line for the onboarding wizard. Pair the input's aria-describedby with `id`. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id} role="alert">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5v4.2M8 10.8v.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </p>
  );
}
