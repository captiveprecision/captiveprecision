# Routine Builder Prototype Summary

## Purpose

This prototype is a local Next.js web app for planning cheerleading routines on an 8-count grid.

The main goal is to let a coach:

- place routine sections on a count map
- resize and move sections across the routine timeline
- overlap up to 3 sections in the same count cell
- annotate key cues in a detail view
- review a read-only summary of the routine in appearance order

This version is intended as a functional prototype that can later be embedded into a larger web application.

## Core UX

The app has three main areas of behavior:

1. Routine setup
   - team name
   - number of eights (rows)

2. Grid editor
   - 8 fixed columns, one for each count in an eight
   - multiple rows, each representing one eight in the routine
   - drag and drop skills into the grid
   - move placed sections by dragging the section title area
   - resize sections from the start or end edges
   - allow overlapping up to 3 sections per cell

3. Right-side control panel
   - available sections
   - placed sections
   - edit durations
   - edit colors
   - remove placed items
   - add coach transitions

## Views

The grid supports 3 views:

### 1. Overview

Editable timeline view.

- shows the routine as thin horizontal blocks
- title appears at the start of the section
- count total appears at the end of the section
- dragging the middle/title area moves the entire section
- dragging the start edge resizes from the start
- dragging the end edge resizes from the end
- selection highlights the section line itself, not the full cell block

### 2. Detail

Coach annotation view.

- uses the same timeline structure as Overview
- adds one cue note input per occupied line per cell
- intended for notes like `clap`, `toss`, `squat`, `deep`
- limited to one cue note per line per cell
- cue notes persist in the saved routine document

### 3. Summary

Read-only routine summary.

- lists sections in the same top-to-bottom order as the Overview grid
- each entry shows:
  - section title
  - start row
  - all cue notes in order
  - count number for each cue
- example output:
  - `Running Tumbling`
  - `Row 5`
  - `clap - 1`
  - `toss - 3`

## Data Model

Main types live in:

- [types.ts](C:/App%20Webs/Prototypes/Routine%20builder/src/lib/types.ts)

Important structures:

### RoutineDocument

Represents the saved routine.

- `config`
- `placements`
- `cueNotes`

### RoutineConfig

- `name`
- `rowCount`
- `columnCount` = 8

### RoutinePlacement

Represents one placed section on the timeline.

- `id`
- `skillId`
- `startRow`
- `startCol`
- `duration`

### SkillDefinition

Represents one available section template.

- `id`
- `name`
- `category`
- `description`
- `defaultDuration`
- `color`
- `tags`

### cueNotes

Stored as a flat dictionary inside `RoutineDocument`.

Key format:

- `placementId:row:col`

Value:

- short cue string for that exact occupied cell/line

## Placement Logic

Core placement math lives in:

- [routine-utils.ts](C:/App%20Webs/Prototypes/Routine%20builder/src/lib/routine-utils.ts)

Important rules:

- the grid always has 8 columns
- duration flows horizontally across the row
- if duration exceeds the remaining cells in a row, it wraps to the next row
- placement validity checks ensure the block stays inside the configured row count
- overlap is allowed, but limited to 3 simultaneous sections in the same cell

Main utility functions:

- `getLinearIndex(row, col)`
- `getCellFromLinearIndex(index)`
- `getOccupiedCells(placement, rowCount)`
- `getPlacementDurationFromCell(placement, targetRow, targetCol)`
- `getPlacementFromStartResize(placement, targetRow, targetCol)`
- `placementFits(...)`
- `placementWithinOverlapLimit(...)`

## Overlap Behavior

When multiple sections occupy the same cell:

- they are rendered as stacked thin lines
- max simultaneous overlap per cell is 3
- lane assignment is stabilized per row so 3 overlapping lines remain ordered consistently

This rendering logic is mainly handled in:

- [routine-grid.tsx](C:/App%20Webs/Prototypes/Routine%20builder/src/components/routine-grid.tsx)

## Transitions

The app supports coach-created transition markers.

Behavior:

- created from an `Add transition` button in `Available sections`
- always white
- color cannot be edited
- meant to indicate athlete movement or repositioning between skills

Transition skills are identified through tags:

- `__transition__`

## Persistence

The prototype currently stores the routine in browser `localStorage`.

Storage key:

- `routine-builder-document`

This is prototype-only persistence and should likely be replaced by app-level state or backend persistence in the real product.

## Recovery Logic

There is recovery logic for saved placements whose `skillId` no longer exists in the current loaded skill list.

Why:

- dynamically created transitions or older saved items can outlive the in-memory/mock skill catalog

What happens:

- missing skills are reconstructed as fallback skills so they still appear in the grid and placed list
- this prevents broken `Unnamed section` items that cannot be selected or removed

This logic is in:

- [routine-builder.tsx](C:/App%20Webs/Prototypes/Routine%20builder/src/components/routine-builder.tsx)

## Main Files

### UI

- [routine-builder.tsx](C:/App%20Webs/Prototypes/Routine%20builder/src/components/routine-builder.tsx)
  - top-level state
  - drag/drop orchestration
  - persistence
  - skill recovery

- [routine-grid.tsx](C:/App%20Webs/Prototypes/Routine%20builder/src/components/routine-grid.tsx)
  - grid rendering
  - overview/detail/summary views
  - lane layout
  - section movement and resizing handles

- [skills-panel.tsx](C:/App%20Webs/Prototypes/Routine%20builder/src/components/skills-panel.tsx)
  - available sections
  - placed sections
  - durations
  - colors
  - remove actions
  - transition creation

### Logic and data

- [routine-utils.ts](C:/App%20Webs/Prototypes/Routine%20builder/src/lib/routine-utils.ts)
- [types.ts](C:/App%20Webs/Prototypes/Routine%20builder/src/lib/types.ts)
- [mock-skills.ts](C:/App%20Webs/Prototypes/Routine%20builder/src/lib/mock-skills.ts)

### Styling

- [globals.css](C:/App%20Webs/Prototypes/Routine%20builder/src/app/globals.css)

## Integration Notes

For integration into the real app, the best path is not to embed this whole prototype app as-is.

Preferred approach:

1. Extract the routine builder into a feature module.
2. Keep the grid/editor logic, but replace mocks with real app data.
3. Replace `localStorage` with app persistence.
4. Move styles out of global scope or isolate them.
5. Mount the builder inside the real app as a reusable feature, not as a nested standalone app.

## Important Assumptions

- 8 counts per row is fixed
- rows represent eights in the routine
- section duration is measured in counts
- overlapping is intentionally allowed
- max overlap per cell is 3
- summary is read-only
- detail notes are coach-facing metadata, not separate sections

## If Another Codex Agent Picks This Up

Preserve these behaviors unless product requirements change:

- move section by dragging the title/body area
- resize from both start and end edges
- title at section start, count total at section end
- overlap up to 3
- stable ordering of overlapping lanes
- transitions remain white
- Summary follows the same top-to-bottom order as Overview
- missing saved skills must remain recoverable
