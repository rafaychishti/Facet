"use client";

import { ChevronDown } from "lucide-react";
import type { Account } from "@/lib/hooks";
import { usd } from "@/lib/format";

const KIND = { paper: "Paper", challenge: "Challenge", competition: "Competition" };

export function AccountSwitcher({ accounts, value, onChange }: { accounts: Account[]; value?: string; onChange: (id: string) => void }) {
  if (accounts.length === 0) return null;
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Trading account</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 max-w-[190px] appearance-none truncate rounded-xl border border-line bg-white/[0.03] pr-8 pl-3 text-xs text-text outline-none hover:border-line-strong focus:border-blue-2"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id} className="bg-panel">
            {a.kind === "paper" ? a.name : `${KIND[a.kind]}: ${a.name.replace(/ challenge$/, "")}`} · {usd(a.equity, 0)}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-dim" />
    </label>
  );
}
