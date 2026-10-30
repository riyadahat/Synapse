import { LoginForm } from "./login-form";
export const metadata = { title: "Sign in" };
export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {" "}
      <section className="hidden bg-olive p-12 text-ivory lg:flex lg:flex-col lg:justify-between">
        {" "}
        <div className="flex items-center gap-2.5 text-[15px] font-medium">
          <LogoMark /> ContextFlow
        </div>{" "}
        <div className="max-w-md">
          {" "}
          <h1 className="font-serif text-[46px] leading-[1.08]">
            Work moves forward. Context stays.
          </h1>{" "}
          <p className="mt-5 text-[15px] leading-relaxed text-sage-soft/80">
            Your team’s shared memory: meetings become decisions and owners,
            unfinished work travels with the people, and anyone can catch up in
            a minute.
          </p>{" "}
        </div>{" "}
        <p className="meta !text-sage-soft/60">
          Built for teams where people go on leave, projects change hands and
          meetings get missed.
        </p>{" "}
      </section>{" "}
      <section className="flex items-center justify-center px-6 py-12">
        {" "}
        <LoginForm
          demoEnabled={process.env.NEXT_PUBLIC_DEMO_ENABLED === "true"}
        />{" "}
      </section>{" "}
    </main>
  );
}
function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="7" cy="11" r="5.2" stroke="#D8DED1" strokeWidth="1.6" />
      <circle cx="15" cy="11" r="5.2" fill="#71816B" />
    </svg>
  );
}
