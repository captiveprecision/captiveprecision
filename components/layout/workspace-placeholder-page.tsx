import { EmptyState, PageHero } from "@/components/ui";

type WorkspacePlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function WorkspacePlaceholderPage({
  eyebrow,
  title,
  description = "This workspace surface is reserved for the next product phase and is being kept intentionally light until the underlying module is ready.",
  emptyTitle = "Coming soon",
  emptyDescription = "This area does not have a live workflow yet. The route remains in place because it is part of the current navigation structure."
}: WorkspacePlaceholderPageProps) {
  return (
    <main className="workspace-shell page-stack">
      <PageHero eyebrow={eyebrow} title={title} description={description} />
      <EmptyState title={emptyTitle} description={emptyDescription} />
    </main>
  );
}
