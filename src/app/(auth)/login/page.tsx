"use client";

import { DismissNote } from "@/components/DismissNote";
import { useState } from "react";
import { Busy } from "@/components/WorkingBeside";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const router = useRouter();
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSigningIn(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold">Gruppo Bravo</h1>
        <p className="mb-4 text-sm text-stone-500">Sign in to inventory</p>
        {!configured ? (
          <DismissNote className="mb-3 text-sm text-amber-700">
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
          </DismissNote>
        ) : null}
        {error ? (
          <DismissNote className="mb-3 text-sm text-red-600" onDismiss={() => setError(null)}>
            {error}
          </DismissNote>
        ) : null}
        <p className="mb-3 text-xs text-stone-500">
          Use the user from Authentication → Users, not your Cursor password.
        </p>
        <label className="mb-3 block text-sm">
          Email
          <input
            className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="mb-4 block text-sm">
          Password
          <input
            className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <Busy on={signingIn} className="w-full">
          <button
            className="w-full rounded bg-stone-900 py-2 text-sm font-medium text-white disabled:opacity-50"
            type="submit"
            disabled={!configured || signingIn}
          >
            Sign in
          </button>
        </Busy>
      </form>
    </div>
  );
}
