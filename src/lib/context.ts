import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role_title: string | null;
  is_seed: boolean;
}
export interface Team {
  id: string;
  name: string;
  is_seed: boolean;
}
/** Authenticated user + active workspace + teammates. RLS enforces isolation; redirects if not signed in / no workspace. */ export const getContext =
  cache(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>();
    if (!profile) redirect("/login");
    const { data: memberships } = await supabase
      .from("team_members")
      .select("role, team:teams(id,name,is_seed)")
      .eq("user_id", user.id);
    const teams = (memberships ?? []).map((m) => ({
      ...(m.team as unknown as Team),
      role: m.role as string,
    }));
    if (!teams.length) redirect("/onboarding");
    const wanted = (await cookies()).get("cf_team")?.value;
    const team = teams.find((t) => t.id === wanted) ?? teams[0];
    const { data: mem } = await supabase
      .from("team_members")
      .select("role, profile:profiles(id,full_name,email,role_title,is_seed)")
      .eq("team_id", team.id);
    const members = (mem ?? [])
      .map((m) => ({
        ...(m.profile as unknown as Profile),
        teamRole: m.role as string,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    return { supabase, user, profile, team, teams, members };
  });
export type Ctx = Awaited<ReturnType<typeof getContext>>;
