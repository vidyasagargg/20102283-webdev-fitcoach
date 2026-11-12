/** Small inline SVG icon set (no icon font download, works offline). */
const PATHS = {
  today: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  gym: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  meals: 'M7 3v8a2 2 0 002 2v8M11 3v8M3 3v8a4 4 0 004 0M17 3c-2 2-2 6 0 8v10',
  water: 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z',
  progress: 'M4 19h16M6 16l4-5 3 3 5-7',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 01-4 0v-.1A1.6 1.6 0 009 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 010-4h.1A1.6 1.6 0 004.6 9a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 13l4 4L19 7',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  close: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 7v5l3 3M12 21a9 9 0 100-18 9 9 0 000 18z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  clipboard: 'M9 4h6v3H9zM8 5H6v16h12V5h-2M9 12h6M9 16h4',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  logout: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
};

export default function Icon({ name, size = 20, className = '', label }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
