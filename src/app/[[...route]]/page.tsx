import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import AccountDeletion from "@/components/account-deletion";
import { deletionConfigured } from "@/lib/account/admin";
import { insightsWorkspace } from "@/lib/insights/server";
import { curriculumWorkspace, reviewWorkspace } from "@/lib/curriculum/server";
import { weekStart } from "@/lib/curriculum/model";
import { z } from "zod";
import { journalWorkspace } from "@/lib/journal/server";
import Workspace from "@/components/workspace";
import { accountWorkspace } from "@/lib/practice/server";
import { notFound } from "next/navigation";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ route?: string[] }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { route } = await params;
  const page = route?.join("/") || "today";
  if (
    ![
      "today",
      "plan",
      "journal",
      "insights",
      "settings",
      "tools/risk",
      "funding",
    ].includes(page) &&
    !/^plan\/[1-6]$/.test(page) &&
    page !== "review" &&
    page !== "setups/new" &&
    page !== "journal/new" &&
    !(
      /^(setups|journal)\//.test(page) &&
      z.uuid().safeParse(page.split("/")[1]).success &&
      page.split("/").length === 2
    ) &&
    !(
      /^review\/\d{4}-\d{2}-\d{2}$/.test(page) &&
      z.iso.date().safeParse(page.split("/")[1]).success &&
      weekStart(page.split("/")[1]) === page.split("/")[1]
    )
  )
    notFound();
  const { from } = await searchParams;
  if (from && !z.uuid().safeParse(from).success) notFound();
  const { client, user } = await requireUser();
  const deleting = await client
    .from("account_deletions")
    .select("requested_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (deleting.error && !["PGRST205", "42P01"].includes(deleting.error.code))
    throw new Error("Could not check account status.");
  if (deleting.data)
    return (
      <main className="deletion-pending">
        <h1>Account deletion is pending</h1>
        <p>
          Account writes are locked while files and records are removed. You can
          retry below. If a fresh sign-in is required, use the sign-in page.
        </p>
        <Link href="/welcome?reauth=1">Get a fresh sign-in link</Link>
        <AccountDeletion configured={deletionConfigured()} />
      </main>
    );
  const account = await accountWorkspace();
  const journal = ["journal", "setups", "insights", "funding"].includes(
    page.split("/")[0],
  )
    ? await journalWorkspace()
    : undefined;
  const insights = ["insights", "funding"].includes(page)
    ? await insightsWorkspace()
    : undefined;
  const learning = ["today", "plan", "review"].includes(page.split("/")[0])
    ? await curriculumWorkspace()
    : undefined;
  const review =
    page.split("/")[0] === "review"
      ? await reviewWorkspace(page.split("/")[1])
      : undefined;
  return (
    <Workspace
      key={`account-${page}`}
      page={page}
      account={{
        ...account,
        deletionConfigured: deletionConfigured(),
        learning,
        review,
        journal,
        insights,
        from,
      }}
    />
  );
}
