'use client';

import { useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { completeOnboarding, rerollDisplayName } from '@/app/(main)/dashboard/actions';
import { cn } from '@/lib/utils';
import type { Gender } from '@/lib/types';

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Other' },
];

export function OnboardingModal({ open, suggestedName, onDone }: { open: boolean; suggestedName: string; onDone: () => void }) {
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<Gender | null>(null);
  const [name, setName] = useState(suggestedName);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reroll = () => start(async () => setName(await rerollDisplayName()));

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
      const res = await completeOnboarding({ gender: gender!, displayName: name });
      if ('error' in res && res.error) {
        setError(res.error);
        setStep(1);
      } else onDone();
    });

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/80 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            className="grain w-full max-w-md rounded-t-2xl border border-haldi/25 bg-ink-2 p-6 pb-8 sm:rounded-2xl"
          >
            <div className="mb-6 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-haldi' : 'bg-paper/10')} />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
                {step === 0 && (
                  <>
                    <h2 className="font-display text-2xl text-paper">Who&apos;s dancing?</h2>
                    <p className="mt-1 text-sm text-paper/60">Shown as a small badge next to your nickname.</p>
                    <div className="relative mt-6 grid grid-cols-3 rounded-full border border-paper/15 p-1">
                      {GENDERS.map((g) => (
                        <button key={g.id} onClick={() => setGender(g.id)} className="relative z-10 h-11 rounded-full text-sm font-bold">
                          {gender === g.id && (
                            <motion.span layoutId="gender-pill" className="absolute inset-0 -z-10 rounded-full bg-kumkum" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                          )}
                          <span className={gender === g.id ? 'text-paper' : 'text-paper/70'}>{g.label}</span>
                        </button>
                      ))}
                    </div>
                    <Button className="mt-8 w-full" disabled={!gender} onClick={() => setStep(1)}>
                      Continue
                    </Button>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h2 className="font-display text-2xl text-paper">Your garba name</h2>
                    <p className="mt-1 text-sm text-paper/60">This is all other dancers see. Your real name stays private.</p>
                    <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-haldi/50 bg-haldi/10 px-4 py-4">
                      <span className="truncate font-display text-lg text-haldi">{name}</span>
                      <button onClick={reroll} disabled={pending} aria-label="Generate another name" className="rounded-full p-2 text-haldi hover:bg-haldi/15">
                        <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} />
                      </button>
                    </div>
                    {error && <p className="mt-3 text-sm text-[#E58A7F]">{error}</p>}
                    <div className="mt-8 flex gap-3">
                      <Button variant="outline" onClick={() => setStep(0)}>
                        Back
                      </Button>
                      <Button className="flex-1" onClick={() => setStep(2)}>
                        Keep this name
                      </Button>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2 className="font-display text-2xl text-paper">Profile photo</h2>
                    <p className="mt-1 text-sm text-paper/60">Optional. It&apos;s only used on your account — dancers see initials, never your photo.</p>
                    <label className="mt-6 flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-paper/25 p-4 hover:border-haldi">
                      {photo || user?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo ?? user!.imageUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-paper/10">
                          <Upload className="h-5 w-5 text-paper/60" />
                        </span>
                      )}
                      <span className="text-sm text-paper/75">{photo ? 'Looking good. Tap to change.' : 'Upload a photo (or keep the default)'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                    </label>
                    <div className="mt-8 flex gap-3">
                      <Button variant="outline" onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Button className="flex-1" disabled={pending} onClick={finish}>
                        {pending ? 'Saving…' : 'Enter the garba'}
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
