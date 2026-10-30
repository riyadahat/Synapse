export default function Setup() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      {" "}
      <h1 className="font-serif text-[32px]">
        Connect Supabase to get started
      </h1>{" "}
      <p className="mt-2 text-muted-strong">
        ContextFlow couldn’t find its Supabase configuration. Three steps:
      </p>{" "}
      <ol className="mt-6 space-y-4 text-[14px]">
        {" "}
        <li className="card card-pad">
          <b>1.</b> Create a Supabase project and run{" "}
          <code className="meta">supabase/migrations/001_schema.sql</code> in
          the SQL editor.
        </li>{" "}
        <li className="card card-pad">
          <b>2.</b> Copy <code className="meta">.env.example</code> to{" "}
          <code className="meta">.env.local</code> and fill in the Supabase URL,
          anon key, service-role key and your Anthropic key.
        </li>{" "}
        <li className="card card-pad">
          <b>3.</b> Run <code className="meta">npm run seed</code>, then restart{" "}
          <code className="meta">npm run dev</code>.
        </li>{" "}
      </ol>{" "}
    </main>
  );
}
