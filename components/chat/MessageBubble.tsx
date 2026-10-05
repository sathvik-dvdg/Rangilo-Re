'use client';

import { motion } from 'framer-motion';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

export function MessageBubble({ message, mine, partnerId }: { message: Message; mine: boolean; partnerId: string }) {
  const read = message.read_by?.includes(partnerId);
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={cn('flex', mine ? 'justify-end' : 'justify-start')}
      style={{ transformOrigin: mine ? 'bottom right' : 'bottom left' }}
    >
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug',
          mine ? 'rounded-br-md bg-kumkum text-paper' : 'rounded-bl-md border border-paper/[0.12] bg-ink-3 text-paper',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <p className={cn('mt-1 flex items-center justify-end gap-1 text-[11px]', mine ? 'text-paper/70' : 'text-paper/45')}>
          {time}
          {mine &&
            (message.pending ? (
              <Clock className="h-3 w-3" aria-label="Sending" />
            ) : read ? (
              <CheckCheck className="h-3.5 w-3.5 text-haldi" aria-label="Read" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-label="Sent" />
            ))}
        </p>
      </div>
    </motion.div>
  );
}
