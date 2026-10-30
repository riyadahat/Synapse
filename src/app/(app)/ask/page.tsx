import { PageHeader } from "@/components/ui";
import { AskClient } from "./ask-client";
export const metadata = { title: "Ask ContextFlow" };
export const maxDuration = 60;
export default function AskPage() {
  return (
    <>
      <PageHeader
        title="Ask ContextFlow"
        description="Ask about decisions, tasks and documents. Answers come only from your team’s records, with sources."
      />
      <AskClient />
    </>
  );
}
