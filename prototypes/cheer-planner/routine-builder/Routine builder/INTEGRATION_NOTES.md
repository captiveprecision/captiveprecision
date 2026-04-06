# Routine Builder Integration Notes

## Goal

Integrate this prototype into the real web app with the least possible friction, while preserving the working interaction model of the prototype.

This document focuses on how to migrate the prototype safely, what to keep, what to replace, and what should not be copied directly.

## Recommended Integration Strategy

Do not integrate this prototype by nesting the whole Next.js app inside the real app.

Preferred path:

1. Copy the prototype into the real repo only as a temporary reference or prototype workspace.
2. Extract the routine builder into a feature module.
3. Replace prototype-only dependencies with real app integrations.
4. Mount the feature inside the existing product shell.

## What Can Be Reused Almost Directly

These files contain the main product logic and are the best candidates for migration:

- [routine-builder.tsx](C:/App%20Webs/Prototypes/Routine%20builder/src/components/routine-builder.tsx)
- [routine-grid.tsx](C:/App%20Webs/Prototypes/Routine%20builder/src/components/routine-grid.tsx)
- [skills-panel.tsx](C:/App%20Webs/Prototypes/Routine%20builder/src/components/skills-panel.tsx)
- [routine-utils.ts](C:/App%20Webs/Prototypes/Routine%20builder/src/lib/routine-utils.ts)
- [types.ts](C:/App%20Webs/Prototypes/Routine%20builder/src/lib/types.ts)

These files should be treated as the feature core.

## What Should Be Replaced

### 1. Mock skills

Current source:

- [mock-skills.ts](C:/App%20Webs/Prototypes/Routine%20builder/src/lib/mock-skills.ts)

In the real app, this should be replaced by a real skill source.

Recommended direction:

- pass `skills` into the routine builder as props
- or inject a real data adapter from the host app

Do not keep the mock file as a production dependency.

### 2. localStorage persistence

Current prototype persistence:

- `routine-builder-document` in browser `localStorage`

In the real app, replace this with:

- app state management
- backend persistence
- autosave API
- draft state controlled by the host page

Recommended interface:

- `initialDocument`
- `onDocumentChange(nextDocument)`
- optional `onSave`

### 3. Global styling

Current styling is heavily centralized in:

- [globals.css](C:/App%20Webs/Prototypes/Routine%20builder/src/app/globals.css)

This should not be copied as-is into the real app unless the real app explicitly wants those global overrides.

Recommended direction:

- move feature styles into CSS Modules
- or isolate them in a feature-level stylesheet
- or convert to the host design system if one exists

## Suggested Folder Structure in the Real Repo

Recommended target shape:

```text
features/
  routine-builder/
    components/
      routine-builder.tsx
      routine-grid.tsx
      skills-panel.tsx
    lib/
      routine-utils.ts
      types.ts
    styles/
      routine-builder.css
    index.ts
```

If the real repo already has a design system or domain structure, adapt this shape to match that project instead of forcing this exact layout.

## Suggested Public API for the Embedded Feature

The feature should ideally become a component with a small integration surface.

Example shape:

```ts
type RoutineBuilderFeatureProps = {
  initialDocument: RoutineDocument;
  skills: SkillDefinition[];
  onDocumentChange: (nextDocument: RoutineDocument) => void;
  readOnly?: boolean;
  teamName?: string;
};
```

Possible future additions:

- `onSave`
- `onAddTransition`
- `onOpenSkill`
- `skillSource`
- `viewMode`

## Feature Behaviors That Must Be Preserved

These are important interaction contracts.

### Placement behavior

- 8 columns fixed per row
- duration wraps into next row
- moving a section repositions the full placement
- resizing from start changes `startRow`, `startCol`, and `duration`
- resizing from end keeps the start fixed and changes only `duration`

### Overlap behavior

- overlap is allowed
- max overlap per cell is 3
- overlapping items must remain visually ordered and stable

### Label behavior

- title is shown at the true start of the section
- count total is shown at the true end of the section
- selection highlights the line, not the whole row block

### View behavior

- `Overview` is editable
- `Detail` is editable and supports cue notes
- `Summary` is read-only
- `Summary` order must follow the same top-to-bottom appearance order as `Overview`

### Transition behavior

- transitions are coach markers
- transitions always stay white
- transitions should not expose normal color editing

### Recovery behavior

- saved placements whose `skillId` is missing from the current source must still be recoverable
- these placements must remain visible and removable

## Migration Plan

### Phase 1. Bring it into the real repo as a prototype

Use this only as a temporary landing step.

1. Copy the prototype folder into the real repo's prototype area.
2. Run it there and confirm it still behaves the same.
3. Avoid changing product architecture during the copy step.

### Phase 2. Extract the feature core

1. Move the builder components and utils into a feature folder.
2. Keep the existing interactions working first.
3. Do not refactor behavior and integration at the same time if avoidable.

### Phase 3. Replace prototype dependencies

1. Replace mock skills with real data.
2. Replace `localStorage` with host-controlled persistence.
3. Replace global CSS with isolated styles or system components.

### Phase 4. Mount inside the real product shell

1. Render the feature inside a real app page.
2. Feed it real team and skill data.
3. Connect save/load behavior.
4. Validate that the host app layout does not break drag interactions.

## Risks During Integration

### 1. Global CSS collisions

Because the prototype uses a large shared stylesheet, styles may leak into the host app or vice versa.

Mitigation:

- isolate styles before or during integration

### 2. Drag and drop hitboxes changing in the host layout

The builder depends on fairly precise drag and resize behavior.

Mitigation:

- retest move and resize after integration into the host layout
- especially test start resize, end resize, and moving by dragging the title area

### 3. Missing skill references

If the real app loads a different skill catalog than the saved draft expects, orphaned placements can appear.

Mitigation:

- preserve the recovery logic
- or provide a product-level migration strategy for missing skills

### 4. State ownership confusion

If both the feature and the host app try to own persistence logic, behavior can become inconsistent.

Mitigation:

- decide clearly whether the feature is controlled or uncontrolled
- for production, prefer controlled or semi-controlled state

## Practical Recommendation

If the other repo already has a `prototypes/` or similar folder:

- yes, copy this project there first
- but treat that as a staging step, not the final integration

Best sequence:

1. Copy prototype into the other repo's prototypes folder.
2. Confirm it runs in that repo.
3. Extract the routine builder feature from there.
4. Embed that feature into the real app shell.

## Good First Integration Milestone

A strong first milestone is:

- the real app renders the `RoutineBuilder` feature
- skills come from the real app
- document state is owned by the host app
- saving no longer depends on `localStorage`

Once that works, the rest becomes iterative refinement instead of risky migration.
