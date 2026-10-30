import { getContext } from "@/lib/context";
import { PageHeader } from "@/components/ui";
import { CatchUpClient } from "./catch-up-client";
export const metadata = { title: "Catch Me Up" };
export const maxDuration = 60;
export default async function CatchUpPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string }>;
}) {
  const sp = await searchParams;
  const { user, members, team } = await getContext();
  return (
    <>
      {" "}
      <PageHeader
        serif
        title="Catch me up"
        description={`A personal briefing on everything that changed in ${team.name} while you were away, built from the actual meetings, decisions and tasks.`}
      />{" "}
      <CatchUpClient
        members={members.map((m) => ({
          id: m.id,
          full_name: m.full_name,
          role_title: m.role_title,
        }))}
        defaultId={
          sp.who && members.some((m) => m.id === sp.who) ? sp.who : user.id
        }
      />{" "}
    </>
  );
}
