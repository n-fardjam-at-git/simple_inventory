"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
          <p className="mb-3 text-sm text-amber-700">
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
            .env.local
          </p>
        ) : null}
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
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
        <button
          className="w-full rounded bg-stone-900 py-2 text-sm font-medium text-white"
          type="submit"
          disabled={!configured}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
