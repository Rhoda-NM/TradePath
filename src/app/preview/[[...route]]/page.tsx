import Workspace from "@/components/workspace";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ route?: string[] }>;
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
    ].includes(page)
  )
    notFound();
  return <Workspace key="preview" page={page} />;
}
