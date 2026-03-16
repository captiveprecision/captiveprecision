export function AppShell({
  title,
  children
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="shell section">
      <div className="card">
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}
