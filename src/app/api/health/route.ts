import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Liveness and dependency check.
 * Reports configuration presence only — never exposes secret values.
 */
export async function GET() {
  const checks: Record<string, "ok" | "missing" | "error"> = {
    supabaseEnv:
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? "ok"
        : "missing",
    aiKey: process.env.ANTHROPIC_API_KEY ? "ok" : "missing",
  };

  if (checks.supabaseEnv === "ok") {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error } = await supabase
        .from("teams")
        .select("id", { head: true, count: "exact" });

      checks.database = error ? "error" : "ok";
    } catch {
      checks.database = "error";
    }
  }

  const healthy = checks.supabaseEnv === "ok" && checks.database === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      time: new Date().toISOString(),
      checks,
    },
    {
      status: healthy ? 200 : 503,
    },
  );
}
