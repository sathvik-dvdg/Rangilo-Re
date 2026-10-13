'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

/**
 * `groupStart` / `groupEnd` mark the first and last bubble in a run from the
 * same sender: runs sit closer together and share one squared-off edge.
 */
export function MessageBubble({
  message,
  mine,
  partnerId,
  groupStart = true,
  groupEnd = true,
}: {
  message: Message;
  mine: boolean;
  partnerId: string;
  groupStart?: boolean;
  groupEnd?: boolean;
}) {
  const read = message.read_by?.includes(partnerId);
  // Format in the browser only: the server's locale and time zone differ from
  // the reader's, which showed wrong times and broke hydration.
  const [time, setTime] = useState('');
  useEffect(() => {
    setTime(new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  }, [message.created_at]);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={cn('flex', mine ? 'justify-end' : 'justify-start', groupStart ? 'mt-3 first:mt-0' : 'mt-1')}
      style={{ transformOrigin: mine ? 'bottom right' : 'bottom left' }}
    >
      <div
        className={cn(
          'flex max-w-[82%] flex-wrap items-end gap-x-3 gap-y-0.5 rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm shadow-black/20 sm:max-w-[72%]',
          mine ? 'rounded-br-md bg-kumkum text-paper' : 'rounded-bl-md border border-paper/[0.1] bg-ink-3 text-paper',
          !groupStart && (mine ? 'rounded-tr-md' : 'rounded-tl-md'),
        )}
      >
        <p className="min-w-0 max-w-full whitespace-pre-wrap break-words">{message.text}</p>
        {(groupEnd || message.pending) && (
          <p className={cn('ml-auto flex h-4 shrink-0 items-center gap-1 text-[11px]', mine ? 'text-paper/70' : 'text-paper/55')}>
            <time dateTime={message.created_at}>{time}</time>
            {mine &&
              (message.pending ? (
                <Clock className="h-3 w-3" aria-label="Sending" />
              ) : read ? (
                <CheckCheck className="h-3.5 w-3.5 text-haldi" aria-label="Read" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-label="Sent" />
              ))}
          </p>
        )}
      </div>
    </motion.div>
  );
}
