import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForms } from "./forms";
export default async function Onboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { count } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (count) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      {" "}
      <h1 className="font-serif text-[32px]">Set up your workspace</h1>{" "}
      <p className="mt-2 text-muted-strong">
        A workspace holds your team’s meetings, tasks and knowledge. You can
        invite teammates later.
      </p>{" "}
      <OnboardingForms
        demoEnabled={process.env.NEXT_PUBLIC_DEMO_ENABLED === "true"}
      />{" "}
    </main>
  );
}
