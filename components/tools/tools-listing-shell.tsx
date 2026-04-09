import { ArrowUpRight } from "lucide-react";

import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  PageColumns,
  PageHero,
  PageMainColumn,
  PageSideColumn,
  SectionHeader
} from "@/components/ui";
import type { ButtonLinkProps } from "@/components/ui";

type ToolItem = {
  id: string;
  label: string;
  title: string;
  description?: string;
  href?: ButtonLinkProps["href"];
  actionLabel?: string;
  statusVariant?: "accent" | "subtle" | "dark" | "neutral";
};

type ToolsListingShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  heroBadges?: string[];
  tools: ToolItem[];
  sideTitle: string;
  sideDescription?: string;
  sideItems: Array<{ label: string; value: string }>;
};

export function ToolsListingShell({
  eyebrow = "Tools",
  title,
  description,
  heroBadges,
  tools,
  sideTitle,
  sideDescription,
  sideItems
}: ToolsListingShellProps) {
  return (
    <main className="workspace-shell page-stack tools-shell">
      <PageHero
        eyebrow={eyebrow}
        title={title}
        description={description}
      >
        {heroBadges?.length ? (
          <div className="tools-hero-badges">
            {heroBadges.map((badge, index) => (
              <Badge key={index} variant={index === 0 ? "accent" : "subtle"}>{badge}</Badge>
            ))}
          </div>
        ) : null}
      </PageHero>

      <PageColumns>
        <PageMainColumn>
          <Card radius="panel">
            <CardContent className="tools-panel__content">
              <SectionHeader
                eyebrow="Tool access"
                title="Available tools"
                description="Open live tools and track upcoming releases from one place."
              />

              <div className="tools-grid">
                {tools.map((tool) => (
                  <Card key={tool.id} variant="subtle" className="tools-card">
                    <CardContent className="tools-card__content">
                      <Badge variant={tool.statusVariant ?? "subtle"}>{tool.label}</Badge>
                      <div className="tools-card__copy">
                        <h3>{tool.title}</h3>
                        {tool.description ? <p>{tool.description}</p> : null}
                      </div>
                      {tool.href ? (
                        <div className="tools-card__actions">
                          <ButtonLink href={tool.href} variant="secondary" trailingIcon={<ArrowUpRight />}>
                            {tool.actionLabel ?? "Open tool"}
                          </ButtonLink>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </PageMainColumn>

        <PageSideColumn>
          <Card radius="panel">
            <CardContent className="tools-panel__content">
              <SectionHeader
                eyebrow="Workspace notes"
                title={sideTitle}
                description={sideDescription}
              />
              <div className="tools-side-list">
                {sideItems.map((item, index) => (
                  <div className="tools-side-item" key={index}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}
