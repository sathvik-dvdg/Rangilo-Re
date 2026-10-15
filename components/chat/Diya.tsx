/** A lit diya, used on the chat page's error screen. */
export function Diya({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M32 6c5 8 7 13 7 17a7 7 0 0 1-14 0c0-4 2-9 7-17Z" fill="#E0782C" />
      <path d="M32 14c2.5 4 3.5 7 3.5 9a3.5 3.5 0 0 1-7 0c0-2 1-5 3.5-9Z" fill="#F3D27A" />
      <path d="M6 34h52c-2 12-12 20-26 20S8 46 6 34Z" fill="#B23A2E" />
      <path d="M10 34h44" stroke="#D8A23A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="44" r="2" fill="#D8A23A" />
      <circle cx="32" cy="46" r="2" fill="#D8A23A" />
      <circle cx="42" cy="44" r="2" fill="#D8A23A" />
    </svg>
  );
}
