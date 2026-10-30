"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Loader2,
  FileText,
  CalendarDays,
  CheckSquare,
  Scale,
  ArrowRightLeft,
} from "lucide-react";
import { generateCatchUp, type CatchUpResult } from "@/app/actions/catchup";
import { ErrorNote, Field } from "@/components/ui";
import type { Source } from "@/lib/sources";
import type { Member } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 864e5));
const ICON = {
  meeting: CalendarDays,
  task: CheckSquare,
  decision: Scale,
  document: FileText,
  handover: ArrowRightLeft,
};
export function SourceChip({ s }: { s: Source }) {
  const Icon = ICON[s.type];
  return (
    <Link
      href={s.href}
      title={s.label}
      className="inline-flex items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 align-baseline font-mono text-[11px] text-sage-dark transition-colors hover:border-sage hover:bg-sage-tint"
    >
      <Icon size={10} />
      {s.alias}
    </Link>
  );
}
export function CatchUpClient({
  members,
  defaultId,
}: {
  members: Member[];
  defaultId: string;
}) {
  const [who, setWho] = useState(defaultId);
  const [from, setFrom] = useState(daysAgo(14));
  const [to, setTo] = useState(iso(new Date()));
  const [res, setRes] = useState<CatchUpResult | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = () => {
    setError(undefined);
    start(async () => {
      const r = await generateCatchUp({ employeeId: who, from, to });
      if (r.ok) setRes(r.data!);
      else {
        setError(r.error);
      }
    });
  };
  return (
    <>
      {" "}
      <div className="card card-pad">
        {" "}
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_160px_160px_auto]">
          {" "}
          <Field label="Who is catching up?">
            <select
              className="input"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                  {m.role_title ? ` · ${m.role_title}` : ""}
                </option>
              ))}
            </select>
          </Field>{" "}
          <Field label="Away from">
            <input
              type="date"
              className="input"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>{" "}
          <Field label="Until">
            <input
              type="date"
              className="input"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>{" "}
          <button
            className="btn-primary !h-10 !px-5"
            onClick={run}
            disabled={pending}
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            {pending ? "Reading the record…" : "Generate Catch-up Brief"}
          </button>{" "}
        </div>{" "}
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
          {" "}
          <span className="text-muted-strong">Quick range:</span>{" "}
          {[
            [7, "last 7 days"],
            [14, "last 2 weeks"],
            [30, "last 30 days"],
            [90, "last 90 days"],
          ].map(([n, l]) => (
            <button
              key={n}
              className="rounded-full border border-line px-2.5 py-0.5 text-muted-strong hover:bg-sage-tint hover:text-ink"
              onClick={() => {
                setFrom(daysAgo(n as number));
                setTo(iso(new Date()));
              }}
            >
              {l}
            </button>
          ))}{" "}
        </div>{" "}
      </div>{" "}
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}{" "}
      {pending && !res && (
        <div className="card mt-5 animate-pulse space-y-3 p-6" aria-hidden>
          <div className="h-6 w-2/3 rounded bg-sage-soft" />
          <div className="h-3 w-full rounded bg-line" />
          <div className="h-3 w-5/6 rounded bg-line" />
          <div className="h-3 w-4/6 rounded bg-line" />
        </div>
      )}{" "}
      {res && (
        <article className="mt-6 space-y-5" aria-live="polite">
          {" "}
          <div className="card card-pad">
            {" "}
            <p className="meta">
              {res.employee} ·{" "}
              {fmtDate(res.from, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              to{" "}
              {fmtDate(res.to, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {res.latencyMs ? ` · ${(res.latencyMs / 1000).toFixed(1)}s` : ""}
            </p>{" "}
            <h2 className="mt-2 font-serif text-[26px] leading-snug">
              {res.headline}
            </h2>{" "}
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-4 lg:grid-cols-7">
              {" "}
              {(
                [
                  ["Meetings", res.stats.meetings],
                  ["Decisions", res.stats.decisions],
                  ["Open tasks", res.stats.openTasks],
                  ["Overdue", res.stats.overdue, res.stats.overdue > 0],
                  ["Blocked", res.stats.blocked, res.stats.blocked > 0],
                  ["Due in 14 days", res.stats.dueSoon],
                  ["Meetings missed", res.stats.missedMeetings],
                ] as [string, number, boolean?][]
              ).map(([l, v, warn]) => (
                <div key={l}>
                  <dd
                    className={`font-serif text-[26px] leading-none ${warn ? "text-terracotta-ink" : ""}`}
                  >
                    {v}
                  </dd>
                  <dt className="mt-1 text-[12px] text-muted-strong">{l}</dt>
                </div>
              ))}{" "}
            </dl>{" "}
          </div>{" "}
          {res.generatedBy === "records" && res.aiNote && (
            <ErrorNote>
              {res.aiNote} This view lists the records directly, without AI.
            </ErrorNote>
          )}{" "}
          {res.sections
            .filter((s) => s.items.length > 0)
            .map((s) => (
              <section key={s.key} className="card card-pad">
                {" "}
                <h3 className="mb-2.5 text-[15px] font-semibold">
                  {s.title}
                </h3>{" "}
                <ul className="space-y-2.5">
                  {s.items.map((i, n) => (
                    <li
                      key={n}
                      className="flex gap-2.5 text-[14.5px] leading-relaxed"
                    >
                      <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-sage" />
                      <span>
                        {i.text}{" "}
                        {i.sources.map((x) => (
                          <span key={x.alias} className="mr-1">
                            <SourceChip s={x} />
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>{" "}
              </section>
            ))}{" "}
          {res.sections.every((s) => s.items.length === 0) &&
            res.generatedBy === "ai" && (
              <p className="text-[14px] text-muted-strong">
                Nothing in the records needs {res.employee.split(" ")[0]}’s
                attention for this period.
              </p>
            )}{" "}
          {res.sources.length > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] font-medium text-muted-strong">
                Sources
              </h3>
              <ul className="grid gap-1 sm:grid-cols-2">
                {res.sources.map((s) => (
                  <li
                    key={s.alias}
                    className="flex items-center gap-2 text-[13px]"
                  >
                    <SourceChip s={s} />
                    <Link
                      href={s.href}
                      className="truncate text-muted-strong hover:text-ink"
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}{" "}
        </article>
      )}{" "}
    </>
  );
}
