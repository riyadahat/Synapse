"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addMember, updateProfile } from "@/app/actions/settings";
import { Field } from "@/components/ui";
export function SettingsForms({
  name,
  role,
  email,
  isAdmin,
}: {
  name: string;
  role: string;
  email: string;
  isAdmin: boolean;
}) {
  const [n, setN] = useState(name);
  const [r, setR] = useState(role);
  const [inv, setInv] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      {" "}
      <section className="card card-pad space-y-3.5">
        <h2 className="text-[15px] font-semibold">Your profile</h2>{" "}
        <Field label="Name">
          <input
            className="input"
            value={n}
            onChange={(e) => setN(e.target.value)}
          />
        </Field>{" "}
        <Field label="Role">
          <input
            className="input"
            value={r}
            onChange={(e) => setR(e.target.value)}
            placeholder="e.g. Backend Developer"
          />
        </Field>{" "}
        <Field label="Email">
          <input className="input" value={email} disabled />
        </Field>{" "}
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const x = await updateProfile(n, r);
              x.ok ? toast.success("Profile saved") : toast.error(x.error);
            })
          }
        >
          Save profile
        </button>
      </section>{" "}
      {isAdmin && (
        <section className="card card-pad space-y-3">
          <h2 className="text-[15px] font-semibold">Add a teammate</h2>
          <p className="text-[13px] text-muted-strong">
            They need a ContextFlow account first.
          </p>{" "}
          <div className="flex gap-2">
            <input
              className="input"
              type="email"
              value={inv}
              onChange={(e) => setInv(e.target.value)}
              placeholder="name@company.com"
              aria-label="Teammate email"
            />
            <button
              className="btn-secondary shrink-0"
              disabled={pending || !inv}
              onClick={() =>
                start(async () => {
                  const x = await addMember(inv);
                  if (x.ok) {
                    toast.success("Teammate added");
                    setInv("");
                  } else toast.error(x.error);
                })
              }
            >
              Add
            </button>
          </div>
        </section>
      )}{" "}
    </div>
  );
}
