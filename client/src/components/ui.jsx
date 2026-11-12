/** Reusable presentational components shared by every page. */
import { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';

export function Card({ title, action, children, className = '', tone, ...rest }) {
  return (
    <section className={`card ${tone ? `card-${tone}` : ''} ${className}`} {...rest}>
      {(title || action) && (
        <header className="card-head">
          {title && <h2 className="card-title">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({ children, variant = 'primary', size, icon, busy, className = '', ...rest }) {
  return (
    <button
      className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`}
      disabled={busy || rest.disabled}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className="spinner spinner-sm" aria-hidden="true" /> : icon && <Icon name={icon} size={18} />}
      {children && <span>{children}</span>}
    </button>
  );
}

/** Labelled input with hint and error, wired up with aria attributes. */
export function Field({ label, error, hint, suffix, as = 'input', className = '', ...rest }) {
  const id = useId();
  const Tag = as;
  return (
    <div className={`field ${error ? 'field-error' : ''} ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-control">
        <Tag
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          {...rest}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
      {(error || hint) && (
        <p id={`${id}-msg`} className={error ? 'field-msg error' : 'field-msg'}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

/** Circular progress ring with the value in the middle. */
export function Ring({ value, max, label, display, color = 'var(--accent)', size = 92, status }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const p = max ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="ring" role="img" aria-label={`${label}: ${status ?? display}`}>
      <svg width={size} height={size} viewBox="0 0 92 92" aria-hidden="true">
        <circle cx="46" cy="46" r={r} className="ring-track" />
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 46 46)"
          className="ring-value"
        />
      </svg>
      <div className="ring-text">
        <strong>{status ?? display}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, label, tone }) {
  const p = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="pbar" role="progressbar" aria-label={label} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className={`pbar-fill ${tone ? `pbar-${tone}` : ''}`} style={{ width: `${p}%` }} />
    </div>
  );
}

export function Loader({ label = 'Loading' }) {
  return (
    <div className="loader" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <Icon name="alert" />
      <p>{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Empty({ icon = 'spark', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

/** Accessible bottom sheet / dialog: focus moves in, Escape closes, focus returns. */
export function Sheet({ open, title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const el = ref.current;
    el?.querySelector('input, textarea, select, button:not(.sheet-close)')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? 'sheet-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={ref}>
        <header className="sheet-head">
          <h2 id="sheet-title">{title}</h2>
          <button className="icon-btn sheet-close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}
