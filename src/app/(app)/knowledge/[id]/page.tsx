import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getContext } from "@/lib/context";
import { SeedChip, StatusChip } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { DocActions } from "./doc-actions";
export default async function DocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, team } = await getContext();
  const { data: d } = await supabase
    .from("documents")
    .select(
      "*,meeting:meetings(id,title),uploader:profiles!documents_uploaded_by_fkey(full_name),task_documents(task:tasks(id,title,status))",
    )
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!d) notFound();
  const [{ data: tasks }, { data: meetings }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title")
      .eq("team_id", team.id)
      .neq("status", "completed")
      .limit(100),
    supabase
      .from("meetings")
      .select("id,title")
      .eq("team_id", team.id)
      .order("scheduled_at", { ascending: false })
      .limit(30),
  ]);
  const linked = (d.task_documents ?? []) as {
    task: { id: string; title: string; status: string };
  }[];
  return (
    <>
      {" "}
      <Link
        href="/knowledge"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-strong hover:text-ink"
      >
        <ArrowLeft size={14} />
        Knowledge Base
      </Link>{" "}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] font-semibold">{d.title}</h1>
        {d.is_seed && <SeedChip />}
      </div>{" "}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {" "}
        <article className="card card-pad">
          <p className="meta mb-4">
            {d.uploader?.full_name ?? "Unknown"} ·{" "}
            {fmtDate(d.created_at, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · {d.char_count.toLocaleString()} characters
            {d.filename && ` · ${d.filename}`}
          </p>{" "}
          <div className="max-w-[68ch] whitespace-pre-wrap font-serif text-[15.5px] leading-[1.75]">
            {d.content.length > 30000
              ? d.content.slice(0, 30000) +
                "\n\n…(truncated for display; the full text is searchable)"
              : d.content}
          </div>
        </article>{" "}
        <aside className="space-y-4">
          {" "}
          <div className="card card-pad text-[13.5px]">
            <p className="label">Related meeting</p>
            {d.meeting ? (
              <Link
                href={`/meetings/${d.meeting.id}`}
                className="font-medium text-sage-dark hover:underline"
              >
                {d.meeting.title}
              </Link>
            ) : (
              <p className="text-muted-strong">Not linked</p>
            )}{" "}
            <p className="label mt-4">Linked tasks</p>
            {linked.length === 0 ? (
              <p className="text-muted-strong">None yet</p>
            ) : (
              <ul className="space-y-1.5">
                {linked.map((l) => (
                  <li
                    key={l.task.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Link href="/tasks?owner=all" className="hover:underline">
                      {l.task.title}
                    </Link>
                    <StatusChip status={l.task.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>{" "}
          <DocActions
            docId={d.id}
            tasks={tasks ?? []}
            meetings={meetings ?? []}
            currentMeeting={d.meeting?.id ?? ""}
            linkedTaskIds={linked.map((l) => l.task.id)}
          />{" "}
        </aside>{" "}
      </div>{" "}
    </>
  );
}
