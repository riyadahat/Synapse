import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export interface CarryItem {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assignee: string | null;
  assignee_id: string | null;
  originMeeting: { id: string; title: string; date: string } | null;
  meetingCount: number;
}
/** Unfinished tasks that came out of (or were discussed in) earlier meetings. One row per task — never duplicated. */ export async function getOpenItems(
  supabase: SupabaseClient,
  teamId: string,
  excludeMeetingId?: string,
): Promise<CarryItem[]> {
  const { data } = await supabase
    .from("tasks")
    .select(
      "id,title,status,due_date,assignee_id,assignee:profiles!tasks_assignee_id_fkey(full_name),origin:meetings!tasks_origin_meeting_id_fkey(id,title,scheduled_at),meeting_tasks!inner(meeting_id,meeting:meetings(id,title,scheduled_at))",
    )
    .eq("team_id", teamId)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false });
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    assignee_id: string | null;
    assignee: { full_name: string } | null;
    origin: { id: string; title: string; scheduled_at: string } | null;
    meeting_tasks: {
      meeting_id: string;
      meeting: { id: string; title: string; scheduled_at: string } | null;
    }[];
  }>;
  return rows
    .filter(
      (r) =>
        !excludeMeetingId ||
        !r.meeting_tasks.some((m) => m.meeting_id === excludeMeetingId),
    )
    .map((r) => {
      const first =
        r.origin ??
        r.meeting_tasks
          .map((m) => m.meeting)
          .filter(Boolean)
          .sort((a, b) => a!.scheduled_at.localeCompare(b!.scheduled_at))[0] ??
        null;
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        due_date: r.due_date,
        assignee: r.assignee?.full_name ?? null,
        assignee_id: r.assignee_id,
        originMeeting: first
          ? { id: first.id, title: first.title, date: first.scheduled_at }
          : null,
        meetingCount: r.meeting_tasks.length,
      };
    });
}
const STOP = new Set(
  "the a an and or of to in on for with is are was were be by at this that it as from we our you your about what why how when which who do did does has have had not but will would should could can into over under after before".split(
    " ",
  ),
);
export const keywords = (text: string, max = 8) =>
  Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w)),
    ),
  ).slice(0, max);
export interface DocHit {
  id: string;
  title: string;
  snippet: string;
  score: number;
  linked?: boolean;
}
/** Keyword (Postgres full-text) relevance over document chunks, plus any documents explicitly linked. */ export async function findRelatedDocuments(
  supabase: SupabaseClient,
  teamId: string,
  text: string,
  opts: { limit?: number; linkedIds?: string[] } = {},
): Promise<DocHit[]> {
  const words = keywords(text);
  const hits = new Map<string, DocHit>();
  if (words.length) {
    const { data } = await supabase
      .from("document_chunks")
      .select("document_id,content,document:documents(id,title)")
      .eq("team_id", teamId)
      .textSearch("tsv", words.join(" or "), {
        type: "websearch",
        config: "english",
      })
      .limit(40);
    for (const c of (data ?? []) as unknown as {
      document_id: string;
      content: string;
      document: { id: string; title: string } | null;
    }[]) {
      if (!c.document) continue;
      const lc = c.content.toLowerCase();
      const score = words.filter((w) => lc.includes(w)).length;
      const cur = hits.get(c.document_id);
      if (!cur || score > cur.score)
        hits.set(c.document_id, {
          id: c.document_id,
          title: c.document.title,
          snippet: snippet(c.content, words),
          score,
        });
    }
  }
  if (opts.linkedIds?.length) {
    const { data } = await supabase
      .from("documents")
      .select("id,title,content")
      .in("id", opts.linkedIds);
    for (const d of data ?? [])
      hits.set(d.id, {
        id: d.id,
        title: d.title,
        snippet: d.content.slice(0, 180),
        score: 99,
        linked: true,
      });
  }
  return Array.from(hits.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 5);
}
function snippet(content: string, words: string[]) {
  const lc = content.toLowerCase();
  const idx = Math.max(
    0,
    Math.min(...words.map((w) => lc.indexOf(w)).filter((i) => i >= 0)),
  );
  return (
    (idx > 40 ? "…" : "") +
    content
      .slice(Math.max(0, idx - 40), idx + 160)
      .replace(/\s+/g, " ")
      .trim() +
    "…"
  );
}
