"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLogger } from "@/lib/logger";
import type { FormState } from "./auth";
export async function createWorkspace(
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const log = await getLogger({ action: "workspace.create" });
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2)
    return { error: "Give your workspace a name (at least 2 characters)." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: team, error } = await supabase
    .from("teams")
    .insert({ name, created_by: user.id })
    .select("id")
    .single();
  if (error || !team) {
    log.error({
      event: "workspace.create_failed",
      errorMessage: error?.message,
    });
    return { error: "Couldn't create the workspace. Try again." };
  }
  const { error: mErr } = await supabase
    .from("team_members")
    .insert({ team_id: team.id, user_id: user.id, role: "admin" });
  if (mErr) {
    log.error({ event: "workspace.member_failed", errorMessage: mErr.message });
    return { error: "Workspace created but you couldn't be added. Try again." };
  }
  (await cookies()).set("cf_team", team.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  log.info({ event: "workspace.created", teamId: team.id, userId: user.id });
  redirect("/dashboard");
}
/** Joins the signed-in user to the seeded demo workspace (service role; the only user-facing use of it). */ export async function joinDemoWorkspace(): Promise<FormState> {
  const log = await getLogger({ action: "workspace.join_demo" });
  if (process.env.NEXT_PUBLIC_DEMO_ENABLED !== "true")
    return { error: "Demo workspace is disabled." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("id")
    .eq("is_seed", true)
    .limit(1)
    .maybeSingle();
  if (!team)
    return {
      error: "The demo workspace hasn't been seeded. Run `npm run seed`.",
    };
  await admin
    .from("team_members")
    .upsert(
      { team_id: team.id, user_id: user.id, role: "member" },
      { onConflict: "team_id,user_id" },
    );
  (await cookies()).set("cf_team", team.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  log.info({
    event: "workspace.joined_demo",
    teamId: team.id,
    userId: user.id,
  });
  redirect("/dashboard");
}
export async function switchWorkspace(teamId: string) {
  (await cookies()).set("cf_team", teamId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
