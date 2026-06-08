import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  rightSlot?: ReactNode;
  isPassword?: boolean;
}

function Crosshair() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="auth-pill-icon" aria-hidden>
      <circle cx="12" cy="12" r="6" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 4.06-5.06" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-3.17 4.19" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export const PillInput = forwardRef<HTMLInputElement, Props>(function PillInput(
  { error, rightSlot, isPassword, type, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  const actualType = isPassword ? (show ? "text" : "password") : type;

  return (
    <div className="auth-field">
      <div className="auth-pill" data-error={!!error}>
        <Crosshair />
        <input ref={ref} type={actualType} {...rest} />
        {isPassword ? (
          <button
            type="button"
            className="auth-pill-right"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
          >
            <EyeIcon open={show} />
          </button>
        ) : rightSlot ? (
          <span className="auth-pill-right" aria-hidden>{rightSlot}</span>
        ) : null}
      </div>
      {error ? <span className="auth-error">{error}</span> : null}
    </div>
  );
});
