"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, Fingerprint, Globe2 } from "lucide-react";
import { checkBrowser, finishStep, type BrowserIssue } from "@/lib/webauthn";
import { Button, Notice } from "./ui";

/**
 * Shown when the phone saved the passkey but needs a second tap to unlock it.
 * The tap has to come from the person, or the browser blocks the request.
 */
export function PasskeyFinish() {
  const waiting = useSyncExternalStore(finishStep.subscribe, finishStep.waiting, () => false);
  const error = useSyncExternalStore(finishStep.subscribe, finishStep.error, () => null);
  if (!waiting) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30 backdrop-blur-sm">
      <div className="sheet mx-auto w-full max-w-md rounded-t-[32px] bg-bg px-6 pb-safe pt-7 shadow-2xl">
        <span className="pop mx-auto flex size-16 items-center justify-center rounded-full bg-good text-white">
          <Check size={30} strokeWidth={3} />
        </span>
        <h2 className="mt-5 text-center text-[24px] font-extrabold tracking-tight">Passkey saved</h2>
        <p className="mt-2 text-center text-ink-2">One more tap to unlock your new account. Your phone will ask for your face or fingerprint again.</p>
        {error ? (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}
        <Button className="mt-6 w-full" onClick={() => finishStep.finish()}>
          <Fingerprint size={20} /> Finish setting up
        </Button>
        <div className="h-4" />
      </div>
    </div>
  );
}

const MESSAGES: Record<Exclude<BrowserIssue, null>, { title: string; body: string }> = {
  "in-app": {
    title: "Open this in your browser",
    body: "Passkeys don't work inside this app's built-in browser. Copy the link and open it in Safari (iPhone) or Chrome (Android).",
  },
  "no-passkeys": {
    title: "This browser can't use passkeys",
    body: "Open the link in Safari on an iPhone, or Chrome on Android, and you'll be in within a minute.",
  },
  "old-ios": {
    title: "Your iPhone needs an update",
    body: "Vesta's passkeys need iOS 18 or newer. Update in Settings, then open the link in Safari. Or use an Android phone with Chrome.",
  },
  "no-prf": {
    title: "Try Chrome or Safari",
    body: "This browser can make passkeys but not the kind Vesta uses to keep your keys on your phone. Open the link in Chrome (Android) or Safari (iPhone).",
  },
};

/** A friendly heads-up before sign-up when the browser won't manage passkeys. */
export function BrowserCheck() {
  const [issue, setIssue] = useState<BrowserIssue>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    checkBrowser().then(setIssue);
  }, []);
  if (!issue) return null;
  const m = MESSAGES[issue];
  return (
    <div className="rise rounded-[24px] bg-ember-tint p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ember text-white">
          <Globe2 size={18} />
        </span>
        <div>
          <p className="font-bold">{m.title}</p>
          <p className="mt-0.5 text-[13.5px] text-ink-2">{m.body}</p>
        </div>
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true));
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-2.5 text-[14px] font-semibold text-hearth"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
