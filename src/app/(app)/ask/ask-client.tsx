"use client";
import { useRef, useState, useTransition } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { askContextFlow, type AskResult } from "@/app/actions/ask";
import { SourceChip } from "../catch-up/catch-up-client";
import { ErrorNote } from "@/components/ui";
const SUGGESTED = [
  "Why was the UI redesign postponed?",
  "What is the status of payment integration?",
  "Which tasks are overdue?",
  "What did we decide in the last meeting?",
  "What should I know before taking over this project?",
];
interface Entry {
  q: string;
  r?: AskResult;
  error?: string;
}
export function AskClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  function ask(text: string) {
    const question = text.trim();
    if (question.length < 3 || pending) return;
    setQ("");
    const i = entries.length;
    setEntries((e) => [...e, { q: question }]);
    start(async () => {
      const r = await askContextFlow(question);
      setEntries((e) =>
        e.map((x, j) =>
          j === i ? (r.ok ? { ...x, r: r.data } : { ...x, error: r.error }) : x,
        ),
      );
      setTimeout(
        () => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
        50,
      );
    });
  }
  return (
    <div className="max-w-3xl">
      {" "}
      {entries.length === 0 && (
        <div className="mb-6">
          <p className="mb-2 text-[13px] font-medium text-muted-strong">
            Try asking
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] hover:border-sage hover:bg-sage-tint"
                onClick={() => ask(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}{" "}
      <div className="space-y-7">
        {" "}
        {entries.map((e, i) => (
          <section key={i}>
            {" "}
            <h2 className="font-serif text-[22px] leading-snug">{e.q}</h2>{" "}
            {!e.r && !e.error && (
              <p className="mt-2 flex items-center gap-2 text-[13.5px] text-muted-strong">
                <Loader2 size={14} className="animate-spin" />
                Searching your records…
              </p>
            )}{" "}
            {e.error && (
              <div className="mt-2">
                <ErrorNote>{e.error}</ErrorNote>
              </div>
            )}{" "}
            {e.r && (
              <div className="card card-pad mt-3">
                {" "}
                {!e.r.found && (
                  <p className="mb-2 text-[12.5px] font-medium text-amber-ink">
                    Not found in your records
                  </p>
                )}{" "}
                <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">
                  {e.r.answer}
                </p>{" "}
                {e.r.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                    <span className="text-[12px] text-muted-strong">
                      Sources
                    </span>
                    {e.r.sources.map((s) => (
                      <span
                        key={s.alias}
                        className="inline-flex items-center gap-1"
                      >
                        <SourceChip s={s} />
                        <span className="text-[12px] text-muted-strong">
                          {s.label.slice(0, 40)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}{" "}
                <p className="meta mt-2">
                  {e.r.retrieved} records considered ·{" "}
                  {(e.r.latencyMs / 1000).toFixed(1)}s
                </p>{" "}
              </div>
            )}{" "}
          </section>
        ))}{" "}
      </div>{" "}
      <div ref={end} />{" "}
      <form
        className="sticky bottom-4 mt-8 flex gap-2 rounded-lg border border-line bg-white p-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        {" "}
        <input
          className="input !border-0 !ring-0"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about a decision, task or document"
          aria-label="Your question"
          maxLength={500}
        />{" "}
        <button
          className="btn-primary shrink-0"
          disabled={pending || q.trim().length < 3}
          aria-label="Ask"
        >
          {pending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <SendHorizontal size={15} />
          )}
          Ask
        </button>{" "}
      </form>{" "}
    </div>
  );
}
