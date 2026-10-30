import { getContext } from "@/lib/context";
import { getOpenItems } from "@/lib/queries";
import { aiConfigured } from "@/lib/ai";
import { PageHeader } from "@/components/ui";
import { NewMeetingForm } from "./new-meeting-form";

export const metadata = {
  title: "New meeting",
};

export const maxDuration = 60;

export default async function NewMeetingPage() {
  const { supabase, team, members, user } = await getContext();

  const openItems = await getOpenItems(supabase, team.id);

  return (
    <>
      <PageHeader
        title="New meeting"
        description="Capture what was discussed. Review everything the AI drafts before it’s saved."
      />

      <NewMeetingForm
        members={members.map((m) => ({
          id: m.id,
          full_name: m.full_name,
          role_title: m.role_title,
        }))}
        currentUserId={user.id}
        openItems={openItems}
        aiAvailable={aiConfigured()}
      />
    </>
  );
}
