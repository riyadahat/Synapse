import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getContext } from "@/lib/context";
import { SourceChip } from "../../catch-up/catch-up-client";
import { Person, SeedChip, StatusChip } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import type { StoredBrief } from "@/app/actions/handovers";
import { HandoverActions } from "./handover-actions";
export default async function HandoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, team, user } = await getContext();
  const { data: h } = await supabase
    .from("handovers")
    .select(
      "*,from:profiles!handovers_from_user_fkey(full_name),to:profiles!handovers_to_user_fkey(full_name),handover_tasks(task_id,transferred,transferred_at,task:tasks(title,status,due_date))",
    )
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!h) notFound();
  const brief = h.brief as StoredBrief | null;
  const tasks = (h.handover_tasks ?? []) as {
    task_id: string;
    transferred: boolean;
    task: { title: string; status: string; due_date: string | null };
  }[];
  return (
    <>
      {" "}
      <Link
        href="/handovers"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-strong hover:text-ink"
      >
        <ArrowLeft size={14} />
        All handovers
      </Link>{" "}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] font-semibold">{h.project}</h1>
        {h.is_seed && <SeedChip />}
        <span className="chip capitalize border-line">{h.status}</span>
      </div>{" "}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {" "}
        <div className="space-y-5">
          {" "}
          {brief?.sections?.map(
            (s) =>
              s.items.length > 0 && (
                <section key={s.key} className="card card-pad">
                  <h2 className="mb-2.5 text-[15px] font-semibold">
                    {s.title}
                  </h2>{" "}
                  <ul className="space-y-2">
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
                  </ul>
                </section>
              ),
          )}{" "}
          {!brief && (
            <p className="card card-pad text-[14px] text-muted-strong">
              This handover was created without a written brief.
            </p>
          )}{" "}
          {h.notes && (
            <section className="card card-pad">
              <h2 className="mb-1.5 text-[15px] font-semibold">
                Notes from {h.from.full_name}
              </h2>
              <p className="whitespace-pre-wrap text-[14px]">{h.notes}</p>
            </section>
          )}{" "}
        </div>{" "}
        <aside className="space-y-5">
          {" "}
          <div className="card card-pad space-y-3 text-[13.5px]">
            {" "}
            <div>
              <p className="label">From</p>
              <Person name={h.from.full_name} />
            </div>
            <div>
              <p className="label">To</p>
              <Person name={h.to.full_name} />
            </div>{" "}
            {h.reason && (
              <div>
                <p className="label">Reason</p>
                <p>{h.reason}</p>
              </div>
            )}{" "}
            <p className="meta">
              Created {fmtDateTime(h.created_at)}
              {h.acknowledged_at &&
                ` · acknowledged ${fmtDateTime(h.acknowledged_at)}`}
            </p>{" "}
          </div>{" "}
          <HandoverActions
            handoverId={h.id}
            status={h.status}
            canRespond={h.to_user === user.id}
            toName={h.to.full_name}
            tasks={tasks.map((t) => ({
              id: t.task_id,
              title: t.task.title,
              status: t.task.status,
              due: t.task.due_date,
              transferred: t.transferred,
            }))}
          />{" "}
          {tasks.length > 0 && h.status !== "pending" && (
            <div className="card">
              <p className="border-b border-line px-4 py-2.5 text-[13px] font-medium">
                Tasks
              </p>
              <ul className="divide-y divide-line">
                {tasks.map((t) => (
                  <li
                    key={t.task_id}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13.5px]"
                  >
                    <span>{t.task.title}</span>
                    {t.transferred ? (
                      <span className="chip border-sage-soft bg-sage-tint text-sage-dark">
                        Transferred
                      </span>
                    ) : (
                      <span className="chip border-line text-muted-strong">
                        Not transferred
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}{" "}
        </aside>{" "}
      </div>{" "}
    </>
  );
}
