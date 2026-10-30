"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { uploadDocument } from "@/app/actions/knowledge";
import { SubmitButton } from "@/components/submit-button";
import { ErrorNote, Field } from "@/components/ui";
import type { ActionResult } from "@/lib/types";
export function UploadForm({
  meetings,
}: {
  meetings: { id: string; title: string }[];
}) {
  const [state, action] = useActionState<
    ActionResult<{ id: string }> | undefined,
    FormData
  >(uploadDocument, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Document added");
      ref.current?.reset();
    }
  }, [state]);
  return (
    <form ref={ref} action={action} className="card card-pad h-fit space-y-3.5">
      {" "}
      <h2 className="text-[15px] font-semibold">Add a document</h2>{" "}
      <Field label="File (PDF or TXT, up to 8 MB)">
        <input
          type="file"
          name="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain"
          className="block w-full text-[13px] file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-[13px] file:font-medium hover:file:bg-sage-tint"
        />
      </Field>{" "}
      <p className="text-center text-[12px] text-muted-strong">or</p>{" "}
      <Field label="Paste text">
        <textarea
          name="text"
          className="input min-h-[80px]"
          placeholder="Paste a runbook, spec excerpt or note"
        />
      </Field>{" "}
      <Field label="Title">
        <input
          name="title"
          className="input"
          placeholder="Defaults to the file name"
        />
      </Field>{" "}
      <Field label="Related meeting (optional)">
        <select name="meetingId" className="input">
          <option value="">None</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </Field>{" "}
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}{" "}
      <SubmitButton>Add to knowledge base</SubmitButton>{" "}
    </form>
  );
}
