"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
export function SubmitButton({
  children,
  className = "btn-primary",
  pending: forced,
}: {
  children: React.ReactNode;
  className?: string;
  pending?: boolean;
}) {
  const { pending } = useFormStatus();
  const busy = pending || forced;
  return (
    <button type="submit" className={className} disabled={busy}>
      {busy && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
