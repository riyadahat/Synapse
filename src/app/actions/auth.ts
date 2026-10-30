"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLogger } from "@/lib/logger";
export type FormState = { error?: string } | undefined;
const creds = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const log = await getLogger({ action: "auth.sign_in" });
  const parsed = creds.safeParse({
    email: fd.get("email"),
    password: fd.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    log.warn({ event: "auth.sign_in_failed", reason: error.code ?? "unknown" });
    return { error: "Email or password is incorrect." };
  }
  log.info({ event: "auth.signed_in" });
  redirect("/dashboard");
}
export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const log = await getLogger({ action: "auth.sign_up" });
  const parsed = creds
    .extend({ fullName: z.string().min(2, "Enter your name") })
    .safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      fullName: fd.get("fullName"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) {
    log.warn({ event: "auth.sign_up_failed", reason: error.code ?? "unknown" });
    return { error: error.message };
  }
  if (!data.session)
    return {
      error:
        "Account created. Confirm your email, then sign in. (Tip: disable email confirmation in Supabase Auth settings for instant access.)",
    };
  log.info({ event: "auth.signed_up", userId: data.user?.id });
  redirect("/onboarding");
}
export async function demoSignIn(who: string): Promise<FormState> {
  const log = await getLogger({ action: "auth.demo_sign_in" });
  if (process.env.NEXT_PUBLIC_DEMO_ENABLED !== "true")
    return { error: "Demo login is disabled." };
  const allowed = ["riya", "harsh", "vedant", "aryan"];
  if (!allowed.includes(who)) return { error: "Unknown demo user." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: `${who}@contextflow.demo`,
    password: process.env.DEMO_PASSWORD ?? "",
  });
  if (error) {
    log.warn({ event: "auth.demo_failed", reason: error.code ?? "unknown" });
    return { error: "Demo users aren't seeded yet. Run `npm run seed` first." };
  }
  redirect("/dashboard");
}
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
