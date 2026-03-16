import { redirect } from "next/navigation";

import { GymSidebar } from "@/components/navigation/gym-sidebar";
import { getAuthSession } from "@/lib/auth/mock-auth";

export default async function GymLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuthSession();

  if (!session || !session.roles.includes("gym")) {
    redirect("/");
  }

  return (
    <div className="app-frame">
      <GymSidebar />
      <div className="app-main">{children}</div>
    </div>
  );
}
