import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getContext } from "@/lib/context";
import { findRelatedDocuments, getOpenItems } from "@/lib/queries";
import { TASK_SELECT, type TaskRow } from "@/lib/types";
import { SeedChip } from "@/components/ui";
import { MeetingTabs } from "./meeting-tabs";
export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, team, members } = await getContext();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!meeting) notFound();
  const [
    { data: parts },
    { data: decisions },
    { data: links },
    { data: linkedDocs },
  ] = await Promise.all([
    supabase
      .from("meeting_participants")
      .select("user_id,attended,profile:profiles(full_name,role_title)")
      .eq("meeting_id", id),
    supabase
      .from("decisions")
      .select("id,text,rationale,source,created_at")
      .eq("meeting_id", id)
      .order("created_at"),
    supabase
      .from("meeting_tasks")
      .select("relation,task:tasks(" + TASK_SELECT + ")")
      .eq("meeting_id", id),
    supabase.from("documents").select("id").eq("meeting_id", id),
  ]);
  const tasks = (
    (links ?? []) as unknown as { relation: string; task: TaskRow }[]
  )
    .filter((l) => l.task)
    .map((l) => ({ ...l.task, relation: l.relation }));
  const [related, openItems] = await Promise.all([
    findRelatedDocuments(
      supabase,
      team.id,
      `${meeting.title} ${meeting.agenda ?? ""} ${tasks.map((t) => t.title).join(" ")}`,
      { linkedIds: (linkedDocs ?? []).map((d) => d.id) },
    ),
    getOpenItems(supabase, team.id, id),
  ]);
  return (
    <>
      {" "}
      <Link
        href="/meetings"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-strong hover:text-ink"
      >
        <ArrowLeft size={14} />
        All meetings
      </Link>{" "}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {" "}
        <h1 className="text-[24px] font-semibold">{meeting.title}</h1>
        {meeting.is_seed && <SeedChip />}{" "}
      </div>{" "}
      <MeetingTabs
        meeting={meeting}
        participants={(parts ?? []) as never}
        decisions={(decisions ?? []) as never}
        tasks={tasks}
        related={related}
        openItems={openItems}
        members={members.map((m) => ({
          id: m.id,
          full_name: m.full_name,
          role_title: m.role_title,
        }))}
      />{" "}
    </>
  );
}
