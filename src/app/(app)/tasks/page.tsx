import { getContext } from "@/lib/context";
import { TASK_SELECT, type TaskRow } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { TasksView } from "./tasks-view";
export const metadata = { title: "My Tasks" };
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; owner?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, team, user, members } = await getContext();
  const { data } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("team_id", team.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);
  return (
    <>
      {" "}
      <PageHeader
        title="Tasks"
        description="Every action item from every meeting, with its full history."
      />{" "}
      <TasksView
        tasks={(data ?? []) as unknown as TaskRow[]}
        members={members.map((m) => ({
          id: m.id,
          full_name: m.full_name,
          role_title: m.role_title,
        }))}
        currentUserId={user.id}
        initial={{
          openNew: sp.new === "1",
          owner: sp.owner ?? "mine",
          status: sp.status ?? "open",
        }}
      />{" "}
    </>
  );
}
