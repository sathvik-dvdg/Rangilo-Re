'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/pushClient';
import { cn } from '@/lib/utils';

/**
 * Lets a dancer turn system notifications on or off for this browser (NOTIF-002).
 * Renders nothing where push cannot work: an unsupported browser, or a server
 * without push keys. In-app notifications do not depend on it.
 */
export function NotificationToggle({ className }: { className?: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState()
      .then(setState)
      .catch(() => setState('unsupported'));
  }, []);

  if (state === null || state === 'unsupported' || state === 'unavailable') return null;

  const toggle = async () => {
    setBusy(true);
    try {
      setState(await (state === 'on' ? disablePush() : enablePush()));
    } catch {
      setState('off');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'blocked') {
    return (
      <p className={cn('flex items-center gap-2 text-xs text-paper/55', className)}>
        <BellOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Notifications are blocked for this site in your browser settings.
      </p>
    );
  }

  const on = state === 'on';
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs transition-colors disabled:opacity-60',
        on ? 'border-[#7FB069]/40 bg-[#7FB069]/10 text-paper/80' : 'border-haldi/40 bg-haldi/10 text-paper hover:bg-haldi/15',
        className,
      )}
    >
      {on ? <BellRing className="h-4 w-4 shrink-0 text-[#9CC587]" aria-hidden /> : <Bell className="h-4 w-4 shrink-0 text-haldi" aria-hidden />}
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block font-bold">{on ? 'Notifications are on' : 'Get notified of new messages'}</span>
        <span className="block text-paper/55">{on ? 'Even when this tab is in the background.' : 'Even when GarbaConnect is not open on screen.'}</span>
      </span>
      <span className={cn('shrink-0 font-bold', on ? 'text-paper/55' : 'text-haldi')}>{busy ? '…' : on ? 'Turn off' : 'Turn on'}</span>
    </button>
  );
}
