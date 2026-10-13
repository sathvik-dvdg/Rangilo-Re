'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Submit button for a destructive form: asks first, and only submits on OK. */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={cn('rounded border px-2.5 py-1 text-xs font-semibold transition-colors', className)}
    >
      {children}
    </button>
  );
}

/** Formats in the browser: the server's time zone is not the admin's. */
export function LocalTime({ iso }: { iso: string | null }) {
  const [text, setText] = useState('');
  useEffect(() => {
    setText(iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
  }, [iso]);
  if (!iso) return <>—</>;
  return <time dateTime={iso}>{text}</time>;
}
