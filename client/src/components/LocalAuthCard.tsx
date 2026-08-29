import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { BrandLogo } from "./Brand";

export function LocalAuthCard() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation({
    onSuccess: user => {
      utils.auth.me.setData(undefined, user);
    },
  });
  const signup = trpc.auth.signup.useMutation({
    onSuccess: user => {
      utils.auth.me.setData(undefined, user);
    },
  });
  const mutation = mode === "login" ? login : signup;
  const isPending = login.isPending || signup.isPending;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "login") login.mutate({ email, password });
    else signup.mutate({ name, email, password });
  }

  return (
    <Card className="w-full max-w-md border-white/[0.08] bg-[#0d1210] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto w-full max-w-[220px]">
          <BrandLogo className="mx-auto h-auto max-h-28 w-full" priority />
        </div>
        <CardTitle className="pt-1 text-xl text-white">
          {mode === "login"
            ? "Sign in to SUBBY VIRTUAL"
            : "Create your SUBBY account"}
        </CardTitle>
        <p className="text-sm leading-6 text-slate-400">
          {mode === "login"
            ? "Use your self-hosted account to access the protected workspace."
            : "Create a secure account for this self-hosted workspace."}
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="auth-name" className="text-slate-300">
                Name
              </Label>
              <Input
                id="auth-name"
                autoComplete="name"
                value={name}
                onChange={event => setName(event.target.value)}
                required
                className="border-white/10 bg-white/[0.04] text-white"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="auth-email" className="text-slate-300">
              Email
            </Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
              className="border-white/10 bg-white/[0.04] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-password" className="text-slate-300">
              Password
            </Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={10}
              maxLength={128}
              required
              className="border-white/10 bg-white/[0.04] text-white"
            />
            {mode === "signup" && (
              <p className="text-xs text-slate-500">
                Use at least 10 characters.
              </p>
            )}
          </div>
          {mutation.error && (
            <p className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-sm text-rose-200">
              {mutation.error.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            {isPending
              ? "Working…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(current => (current === "login" ? "signup" : "login"));
            login.reset();
            signup.reset();
          }}
          className="mt-4 w-full text-center text-sm text-emerald-500 hover:text-emerald-400"
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </CardContent>
    </Card>
  );
}
