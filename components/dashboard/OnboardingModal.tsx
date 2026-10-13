'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { Lock, RefreshCw, Sparkles, Upload, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/button';
import { completeOnboarding, rerollDisplayName } from '@/app/(main)/dashboard/actions';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';
import type { Gender } from '@/lib/types';

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Other' },
];

export function OnboardingModal({
  open,
  suggestedName,
  initialGender = null,
  initialRealName = '',
  initialEmail = '',
  onDone,
  onClose,
}: {
  open: boolean;
  suggestedName: string;
  initialGender?: Gender | null;
  initialRealName?: string;
  initialEmail?: string;
  onDone: () => void;
  onClose?: () => void;
}) {
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<Gender | null>(initialGender);
  const [name, setName] = useState(suggestedName);
  const [realName, setRealName] = useState(initialRealName);
  const [email, setEmail] = useState(initialEmail);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, open);

  const isEditing = Boolean(initialGender);

  useEffect(() => {
    if (open) {
      if (initialGender) {
        setGender(initialGender);
        setStep(1);
      } else {
        setStep(0);
      }
      if (suggestedName) setName(suggestedName);
      if (initialRealName) setRealName(initialRealName);
      if (initialEmail) setEmail(initialEmail);
      setError(null);
    }
  }, [open, initialGender, suggestedName, initialRealName, initialEmail]);

  useEffect(() => {
    if (user && !isEditing) {
      if (!realName) {
        const full = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || '';
        if (full) setRealName(full);
      }
      if (!email) {
        const mail = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? '';
        if (mail) setEmail(mail);
      }
    }
  }, [user, realName, email, isEditing]);

  const reroll = () =>
    start(async () => {
      const generated = await rerollDisplayName();
      setName(generated);
      setError(null);
    });

  const upload = async (file: File) => {
    setPhoto(URL.createObjectURL(file));
    try {
      await user?.setProfileImage({ file });
    } catch {
      setError('Photo upload failed — you can skip this step.');
    }
  };

  const finish = () =>
    start(async () => {
      setError(null);
      if (!name.trim()) {
        setError('Please enter a garba nickname.');
        setStep(1);
        return;
      }
      const res = await completeOnboarding({
        gender: gender!,
        displayName: name.trim(),
        realName: realName.trim(),
        email: email.trim(),
      });
      if ('error' in res && res.error) {
        setError(res.error);
        setStep(1);
      } else {
        onDone();
      }
    });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            className="grain relative max-h-[92dvh] w-full max-w-md overflow-y-auto outline-none rounded-t-2xl border border-haldi/25 bg-ink-2 p-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
          >
            {onClose && isEditing && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-full p-1.5 text-paper/50 hover:bg-paper/10 hover:text-paper transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            <div className="mb-6 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-haldi' : 'bg-paper/10')} />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
                {step === 0 && (
                  <>
                    <h2 id="onboarding-title" className="font-display text-2xl text-paper">
                      Who&apos;s dancing?
                    </h2>
                    <p className="mt-1 text-sm text-paper/60">
                      Choose your avatar style. Male and female have distinct festive garba avatars!
                    </p>

                    <div className="mt-5 flex justify-center">
                      <div className="flex flex-col items-center">
                        <Avatar name={name || 'Dancer'} gender={gender || 'female'} size={68} />
                        <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-haldi">
                          {gender === 'female'
                            ? 'Female Garba Avatar'
                            : gender === 'male'
                              ? 'Male Garba Avatar'
                              : gender === 'other'
                                ? 'Festive Dandiya Avatar'
                                : 'Select Gender'}
                        </span>
                      </div>
                    </div>

                    <div role="group" aria-label="Gender" className="relative mt-5 grid grid-cols-3 rounded-full border border-paper/15 p-1 bg-ink">
                      {GENDERS.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGender(g.id)}
                          aria-pressed={gender === g.id}
                          className="relative z-10 h-11 rounded-full text-sm font-bold transition-colors"
                        >
                          {gender === g.id && (
                            <motion.span
                              layoutId="gender-pill"
                              className="absolute inset-0 -z-10 rounded-full bg-kumkum"
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                          )}
                          <span className={gender === g.id ? 'text-paper' : 'text-paper/70'}>{g.label}</span>
                        </button>
                      ))}
                    </div>
                    <Button className="mt-7 w-full" disabled={!gender} onClick={() => setStep(1)}>
                      Continue
                    </Button>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h2 id="onboarding-title" className="font-display text-2xl text-paper">
                      {isEditing ? 'Edit Profile' : 'Your Garba Identity'}
                    </h2>
                    <p className="mt-1 text-sm text-paper/60">
                      Choose your public garba nickname and private contact details.
                    </p>

                    {/* Nickname Field */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-haldi">
                          Garba Nickname (Public)
                        </label>
                        <span className="text-[11px] text-paper/40">Visible to all dancers</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <Avatar name={name || 'Dancer'} gender={gender || undefined} size={44} />
                        <div className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-haldi/50 bg-haldi/10 px-3.5 py-2 focus-within:border-haldi focus-within:ring-1 focus-within:ring-haldi transition-all">
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              setError(null);
                            }}
                            placeholder="Type your garba nickname..."
                            maxLength={32}
                            className="w-full bg-transparent font-display text-lg text-haldi placeholder:text-haldi/40 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={reroll}
                            disabled={pending}
                            title="Generate a random garba nickname"
                            aria-label="Generate another name"
                            className="shrink-0 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-haldi hover:bg-haldi/20 transition-colors"
                          >
                            <RefreshCw className={cn('h-3.5 w-3.5', pending && 'animate-spin')} />
                            <span className="hidden sm:inline">Reroll</span>
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-paper/50">
                        Type any name of your choice, or tap Reroll for an authentic festive nickname.
                      </p>
                    </div>

                    {/* Private Details Box */}
                    <div className="mt-5 rounded-xl border border-haldi/25 bg-ink/60 p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-haldi/15 text-haldi">
                          <Lock className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-paper/90">
                          Private Details (Unlocked via ₹29)
                        </p>
                      </div>
                      <p className="mt-1.5 text-xs text-paper/60 leading-relaxed">
                        These remain hidden. When another dancer pays ₹29 to unlock your identity, your real name and Gmail will be revealed to them.
                      </p>

                      <div className="mt-3.5 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-paper/80">
                            Real Name
                          </label>
                          <input
                            type="text"
                            value={realName}
                            onChange={(e) => setRealName(e.target.value)}
                            placeholder="e.g. Aarohi Mehta"
                            maxLength={50}
                            className="mt-1 w-full rounded-lg border border-paper/15 bg-ink-2 px-3 py-2 text-sm text-paper placeholder:text-paper/30 focus:border-haldi focus:outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-paper/80">
                            Gmail / Email Address
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g. aarohi.mehta@gmail.com"
                            maxLength={80}
                            className="mt-1 w-full rounded-lg border border-paper/15 bg-ink-2 px-3 py-2 text-sm text-paper placeholder:text-paper/30 focus:border-haldi focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    {error && <p className="mt-3 text-sm text-[#E58A7F]">{error}</p>}

                    <div className="mt-6 flex gap-3">
                      <Button variant="outline" onClick={() => setStep(0)}>
                        Back
                      </Button>
                      {isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (!name.trim()) {
                                setError('Please enter a garba nickname.');
                                return;
                              }
                              setStep(2);
                            }}
                          >
                            Photo →
                          </Button>
                          <Button className="flex-1" disabled={pending || !name.trim()} onClick={finish}>
                            {pending ? 'Saving…' : 'Save Changes'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          className="flex-1"
                          disabled={!name.trim()}
                          onClick={() => {
                            if (!name.trim()) {
                              setError('Please enter a garba nickname.');
                              return;
                            }
                            setStep(2);
                          }}
                        >
                          Continue to Photo →
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2 id="onboarding-title" className="font-display text-2xl text-paper">
                      Profile photo
                    </h2>
                    <p className="mt-1 text-sm text-paper/60">
                      Optional. Used only on your private account — other dancers see festive initials, never your photo.
                    </p>
                    <label className="mt-6 flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-paper/25 p-4 focus-within:border-haldi focus-within:ring-2 focus-within:ring-haldi hover:border-haldi transition-colors">
                      {photo || user?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo ?? user!.imageUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-paper/10">
                          <Upload className="h-5 w-5 text-paper/60" />
                        </span>
                      )}
                      <span className="text-sm text-paper/75">
                        {photo ? 'Looking good. Tap to change.' : 'Upload a photo (or keep the default)'}
                      </span>
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                    </label>
                    <div className="mt-8 flex gap-3">
                      <Button variant="outline" onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Button className="flex-1" disabled={pending} onClick={finish}>
                        {pending ? 'Saving…' : isEditing ? 'Save Profile' : 'Enter the garba'}
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
