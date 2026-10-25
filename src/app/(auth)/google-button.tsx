"use client";

export function GoogleButton({ label = "Continue with Google", onClick }: { label?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-white/[0.03] text-sm hover:bg-white/[0.07]">
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
      </svg>
      {label}
    </button>
  );
}

export function Divider({ text = "or continue with email" }: { text?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[11px] text-dim">
      <span className="h-px flex-1 bg-line" />{text}<span className="h-px flex-1 bg-line" />
    </div>
  );
}
