import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth/mock-auth";
import { CoachSidebar } from "@/components/navigation/coach-sidebar";

export default async function CoachLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();

  if (!session || !session.roles.includes("coach")) {
    redirect("/");
  }

  return (
    <div className="app-frame">
      <CoachSidebar />
      <div className="app-main">{children}</div>
    </div>
  );
}
