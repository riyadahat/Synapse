"use client";
import { useActionState, useState, useTransition } from "react";
import { createWorkspace, joinDemoWorkspace } from "@/app/actions/workspace";
import type { FormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { ErrorNote, Field } from "@/components/ui";
export function OnboardingForms({ demoEnabled }: { demoEnabled: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(
    createWorkspace,
    undefined,
  );
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="mt-8 space-y-6">
      {" "}
      <form action={action} className="card card-pad space-y-4">
        {" "}
        <Field label="Workspace name">
          <input
            name="name"
            className="input"
            placeholder="e.g. Product Engineering"
            required
          />
        </Field>{" "}
        {state?.error && <ErrorNote>{state.error}</ErrorNote>}{" "}
        <SubmitButton>Create workspace</SubmitButton>{" "}
      </form>{" "}
      {demoEnabled && (
        <div className="card card-pad">
          {" "}
          <p className="font-medium">Just looking around?</p>{" "}
          <p className="mt-1 text-[13.5px] text-muted-strong">
            Join the Product Engineering demo workspace with sample meetings,
            tasks and a handover.
          </p>{" "}
          <button
            className="btn-secondary mt-3"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await joinDemoWorkspace();
                if (r?.error) setErr(r.error);
              })
            }
          >
            Join demo workspace
          </button>{" "}
          {err && (
            <div className="mt-3">
              <ErrorNote>{err}</ErrorNote>
            </div>
          )}{" "}
        </div>
      )}{" "}
    </div>
  );
}
