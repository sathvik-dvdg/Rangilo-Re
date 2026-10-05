/** Logo mark: an eight-petal rangoli drawn as a single stroke family. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <circle cx="16" cy="16" r="3" fill="#D8A23A" />
      {Array.from({ length: 8 }).map((_, i) => (
        <path
          key={i}
          d="M16 12.5c-2.2-2.4-2.2-6 0-9 2.2 3 2.2 6.6 0 9Z"
          fill={i % 2 ? '#B23A2E' : '#D8A23A'}
          transform={`rotate(${i * 45} 16 16)`}
        />
      ))}
    </svg>
  );
}
