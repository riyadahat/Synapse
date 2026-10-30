"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { getLogger } from "@/lib/logger";
import { recordActivity } from "@/lib/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
export async function updateProfile(
  fullName: string,
  roleTitle: string,
): Promise<ActionResult> {
  const n = z.string().trim().min(2).max(80).safeParse(fullName);
  if (!n.success) return { ok: false, error: "Enter your name." };
  const { supabase, user } = await getContext();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: n.data,
      role_title: roleTitle.trim().slice(0, 80) || null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your profile." };
  revalidatePath("/", "layout");
  return { ok: true };
}
/** Admin adds an existing ContextFlow user (by email) to the workspace. */ export async function addMember(
  email: string,
): Promise<ActionResult> {
  const log = await getLogger({ action: "workspace.add_member" });
  const e = z.string().trim().toLowerCase().email().safeParse(email);
  if (!e.success) return { ok: false, error: "Enter a valid email address." };
  const { supabase, user, team } = await getContext();
  if (!team.role || team.role !== "admin")
    return { ok: false, error: "Only workspace admins can add people." };
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("id,full_name")
    .eq("email", e.data)
    .maybeSingle();
  if (!p)
    return {
      ok: false,
      error:
        "No ContextFlow account uses that email yet. Ask them to sign up first.",
    };
  const { error } = await admin
    .from("team_members")
    .upsert(
      { team_id: team.id, user_id: p.id, role: "member" },
      { onConflict: "team_id,user_id" },
    );
  if (error) return { ok: false, error: "Couldn't add that person." };
  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "workspace.member_added",
    entityType: "team",
    entityId: team.id,
    summary: `added ${p.full_name} to the workspace`,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
