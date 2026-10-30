"use client";
import { useActionState, useState, useTransition } from "react";
import { signIn, signUp, demoSignIn, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { ErrorNote, Field } from "@/components/ui";
const DEMO = [
  { id: "riya", name: "Riya", role: "Project Manager" },
  { id: "harsh", name: "Harsh", role: "Backend Developer" },
  { id: "vedant", name: "Vedant", role: "Frontend Developer" },
  { id: "aryan", name: "Aryan", role: "QA Engineer" },
];
export function LoginForm({ demoEnabled }: { demoEnabled: boolean }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction] = useActionState<FormState, FormData>(
    signIn,
    undefined,
  );
  const [upState, upAction] = useActionState<FormState, FormData>(
    signUp,
    undefined,
  );
  const [demoErr, setDemoErr] = useState<string>();
  const [pending, start] = useTransition();
  const state = mode === "in" ? inState : upState;
  return (
    <div className="w-full max-w-sm">
      {" "}
      <h2 className="font-serif text-[28px]">
        {mode === "in" ? "Welcome back" : "Create your account"}
      </h2>{" "}
      <p className="mt-1 text-[14px] text-muted-strong">
        {mode === "in"
          ? "Sign in to pick up where your team left off."
          : "Start a workspace for your team."}
      </p>{" "}
      <form
        action={mode === "in" ? inAction : upAction}
        className="mt-6 space-y-4"
      >
        {" "}
        {mode === "up" && (
          <Field label="Full name">
            <input
              name="fullName"
              className="input"
              autoComplete="name"
              required
            />
          </Field>
        )}{" "}
        <Field label="Work email">
          <input
            name="email"
            type="email"
            className="input"
            autoComplete="email"
            required
          />
        </Field>{" "}
        <Field
          label="Password"
          hint={mode === "up" ? "At least 8 characters." : undefined}
        >
          <input
            name="password"
            type="password"
            className="input"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            required
            minLength={8}
          />
        </Field>{" "}
        {state?.error && <ErrorNote>{state.error}</ErrorNote>}{" "}
        <SubmitButton className="btn-primary w-full">
          {mode === "in" ? "Sign in" : "Create account"}
        </SubmitButton>{" "}
      </form>{" "}
      <p className="mt-4 text-[13.5px] text-muted-strong">
        {" "}
        {mode === "in"
          ? "New to ContextFlow? "
          : "Already have an account? "}{" "}
        <button
          className="font-medium text-sage-dark underline underline-offset-2"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "Create an account" : "Sign in"}
        </button>{" "}
      </p>{" "}
      {demoEnabled && (
        <div className="mt-8 border-t border-line pt-6">
          {" "}
          <p className="label">Explore the demo workspace as</p>{" "}
          <div className="grid grid-cols-2 gap-2">
            {" "}
            {DEMO.map((d) => (
              <button
                key={d.id}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await demoSignIn(d.id);
                    if (r?.error) setDemoErr(r.error);
                  })
                }
                className="btn-secondary !h-auto flex-col !items-start !gap-0 py-2 text-left"
              >
                {" "}
                <span>{d.name}</span>
                <span className="text-[12px] font-normal text-muted-strong">
                  {d.role}
                </span>{" "}
              </button>
            ))}{" "}
          </div>{" "}
          {demoErr && (
            <div className="mt-3">
              <ErrorNote>{demoErr}</ErrorNote>
            </div>
          )}{" "}
        </div>
      )}{" "}
    </div>
  );
}
