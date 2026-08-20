"use client";

import { Suspense, useActionState, useState } from "react";
import { Zap } from "lucide-react";
import { loginAction, registerOrgAction } from "./actions";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, {});
  const [registerState, registerFormAction, registerPending] = useActionState(registerOrgAction, {});

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-graphite-950 px-4">
      <div className="bp-grid-dark pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-500/10 blur-[100px]" />

      <div className="relative w-full max-w-sm animate-fade-up rounded-2xl border border-graphite-700 bg-graphite-900/90 p-7 shadow-2xl backdrop-blur-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-signal-400/30 bg-signal-500/10 text-signal-300 shadow-glow">
            <Zap className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Stratum AI</h1>
          <p className="mt-1 text-xs text-slate-400">
            {mode === "login" ? "Sign in to your organization" : "Create your organization"}
          </p>
        </div>

        {mode === "login" ? (
          <form action={loginFormAction} className="space-y-3">
            <input type="hidden" name="next" value={next} />
            <Field name="email" label="Email" type="email" />
            <Field name="password" label="Password" type="password" />
            {loginState?.error && <p className="text-xs font-medium text-rose-400">{loginState.error}</p>}
            <button
              disabled={loginPending}
              className="w-full rounded-lg bg-signal-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-signal-700 hover:shadow-glow active:scale-[0.99] disabled:opacity-50"
            >
              {loginPending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form action={registerFormAction} className="space-y-3">
            <Field name="orgName" label="Organization name" />
            <Field name="name" label="Your name" />
            <Field name="email" label="Email" type="email" />
            <Field name="password" label="Password" type="password" />
            {registerState?.error && <p className="text-xs font-medium text-rose-400">{registerState.error}</p>}
            <button
              disabled={registerPending}
              className="w-full rounded-lg bg-signal-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-signal-700 hover:shadow-glow active:scale-[0.99] disabled:opacity-50"
            >
              {registerPending ? "Creating…" : "Create organization"}
            </button>
          </form>
        )}

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 w-full text-center text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
        >
          {mode === "login" ? "New here? Create an organization" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function Field({ name, label, type = "text" }: { name: string; label: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        required
        className="w-full rounded-lg border border-graphite-600 bg-graphite-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-signal-500 focus:outline-none focus:ring-2 focus:ring-signal-500/20"
      />
    </label>
  );
}
