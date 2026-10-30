import { getContext } from "@/lib/context";
import { PageHeader } from "@/components/ui";
import { NewHandoverForm } from "./new-handover-form";
export const metadata = { title: "Create handover" };
export const maxDuration = 60;
export default async function NewHandover() {
  const { members, user, team } = await getContext();
  return (
    <>
      <PageHeader
        title="Create handover"
        description="Pick who is handing over and who is taking over. ContextFlow gathers their open tasks, decisions and documents into a brief you can edit."
      />{" "}
      <NewHandoverForm
        members={members.map((m) => ({
          id: m.id,
          full_name: m.full_name,
          role_title: m.role_title,
        }))}
        currentUserId={user.id}
        defaultProject={team.name}
      />
    </>
  );
}
