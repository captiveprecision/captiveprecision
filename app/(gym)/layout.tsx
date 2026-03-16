import { GymSidebar } from "@/components/navigation/gym-sidebar";

export default function GymLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-frame">
      <GymSidebar />
      <div className="app-main">{children}</div>
    </div>
  );
}
