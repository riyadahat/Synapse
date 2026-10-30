import { getContext } from "@/lib/context";
import { aiConfigured } from "@/lib/ai";
import { Avatar, PageHeader, SeedChip } from "@/components/ui";
import { SettingsForms } from "./settings-forms";
export const metadata = { title: "Settings" };
export default async function SettingsPage() {
  const { profile, team, members, user } = await getContext();
  const teamWithRole = (await getContext()).teams.find((t) => t.id === team.id);
  return (
    <>
      {" "}
      <PageHeader title="Settings" />{" "}
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        {" "}
        <SettingsForms
          name={profile.full_name}
          role={profile.role_title ?? ""}
          email={profile.email ?? ""}
          isAdmin={teamWithRole?.role === "admin"}
        />{" "}
        <section className="card card-pad">
          <h2 className="mb-3 text-[15px] font-semibold">
            {team.name} {team.is_seed && <SeedChip />}
          </h2>{" "}
          <ul className="space-y-2.5">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.full_name} />
                <div className="flex-1 text-[13.5px]">
                  <p className="font-medium">
                    {m.full_name}
                    {m.id === user.id && (
                      <span className="text-muted-strong"> (you)</span>
                    )}
                  </p>
                  <p className="text-[12.5px] text-muted-strong">
                    {m.role_title ?? "Team member"}
                  </p>
                </div>
                <span className="meta">{m.teamRole}</span>
              </li>
            ))}
          </ul>
        </section>{" "}
        <section className="card card-pad md:col-span-2">
          <h2 className="mb-2 text-[15px] font-semibold">System</h2>
          <dl className="grid gap-x-8 gap-y-2 text-[13.5px] sm:grid-cols-2">
            {" "}
            <div className="flex justify-between">
              <dt className="text-muted-strong">AI provider</dt>
              <dd>
                {aiConfigured()
                  ? `Configured (${process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5"})`
                  : "Not configured. Manual mode only"}
              </dd>
            </div>{" "}
            <div className="flex justify-between">
              <dt className="text-muted-strong">Log level</dt>
              <dd className="font-mono text-[12px]">
                {process.env.LOG_LEVEL ?? "info"}
              </dd>
            </div>{" "}
            <div className="flex justify-between">
              <dt className="text-muted-strong">File logging</dt>
              <dd>
                {process.env.LOG_TO_FILE === "true"
                  ? "On (local)"
                  : "Off (stdout only)"}
              </dd>
            </div>
          </dl>
        </section>{" "}
      </div>{" "}
    </>
  );
}
