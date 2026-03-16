import { CoachSidebar } from "@/components/navigation/coach-sidebar";

export default function CoachLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-frame">
      <CoachSidebar />
      <div className="app-main">{children}</div>
    </div>
  );
}
