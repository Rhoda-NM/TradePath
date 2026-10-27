import Onboarding from "@/components/onboarding";
import { requireUser } from "@/lib/auth/server";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { client, user } = await requireUser();
  const { data, error } = await client
    .from("profiles")
    .select("timezone,available_minutes,start_date,capital_kes")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    throw new Error(
      "Account storage is unavailable. Apply the database migrations first.",
    );
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <span className="eyebrow">YOUR LEARNING ROUTINE</span>
        <h1>{data ? "Your preferences" : "Make space to practise."}</h1>
        <p>Choose a manageable routine. You can update it later.</p>
        <Onboarding profile={data} />
      </section>
    </main>
  );
}
