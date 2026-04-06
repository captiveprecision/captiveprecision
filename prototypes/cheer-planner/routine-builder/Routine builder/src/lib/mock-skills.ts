import { SkillDefinition, SkillsSource } from "@/lib/types";

const MOCK_SKILLS: SkillDefinition[] = [
  {
    id: "opening-pyramid-hit",
    name: "Pyramid Hit",
    category: "Opening",
    description: "Strong opening image with top-level visual impact across the first phrase.",
    defaultDuration: 8,
    color: "#35524a",
    tags: ["visual", "opening", "formation"],
  },
  {
    id: "opening-ripple-entry",
    name: "Ripple Entry",
    category: "Opening",
    description: "Athletes enter on a staggered ripple to build momentum into the first stunt.",
    defaultDuration: 4,
    color: "#587792",
    tags: ["entrance", "ripple", "clean"],
  },
  {
    id: "tumbling-standing-pass",
    name: "Standing Pass",
    category: "Tumbling",
    description: "Short standing tumbling sequence for a sharp transition beat.",
    defaultDuration: 4,
    color: "#c06c3e",
    tags: ["tumbling", "power", "sync"],
  },
  {
    id: "tumbling-running-section",
    name: "Running Tumbling",
    category: "Tumbling",
    description: "Traveling tumbling section with enough counts to stage a visual diagonal.",
    defaultDuration: 8,
    color: "#bb8a2f",
    tags: ["travel", "tumbling", "high-energy"],
  },
  {
    id: "stunts-lib-extension",
    name: "Lib Extension",
    category: "Stunts",
    description: "Main stunt section rising to a liberty extension on a strong hit.",
    defaultDuration: 8,
    color: "#8f4f7a",
    tags: ["stunts", "elite", "visual"],
  },
  {
    id: "stunts-basket-sequence",
    name: "Basket Sequence",
    category: "Stunts",
    description: "Basket toss phrase planned for a featured music accent and crowd reaction.",
    defaultDuration: 8,
    color: "#995f9a",
    tags: ["toss", "release", "feature"],
  },
  {
    id: "dance-clean-eight",
    name: "Dance Clean Eight",
    category: "Dance",
    description: "Compact dance phrase with clear arm lines and timing emphasis.",
    defaultDuration: 8,
    color: "#d95d39",
    tags: ["dance", "sharp", "visual"],
  },
  {
    id: "dance-hype-section",
    name: "Hype Section",
    category: "Dance",
    description: "Crowd-facing dance and chant section that resets the floor picture.",
    defaultDuration: 16,
    color: "#d47f2f",
    tags: ["crowd", "dance", "reset"],
  },
  {
    id: "transitions-load-in",
    name: "Load-In Transition",
    category: "Transitions",
    description: "Travel counts used to load stunt groups while preserving timing clarity.",
    defaultDuration: 4,
    color: "#4d6a84",
    tags: ["transition", "formations", "prep"],
  },
  {
    id: "transitions-clean-up",
    name: "Clean-Up Exit",
    category: "Transitions",
    description: "Short exit phrase to finish a section and reposition for the next visual.",
    defaultDuration: 4,
    color: "#6c7b4f",
    tags: ["exit", "transition", "reset"],
  },
];

export class MockSkillsSource implements SkillsSource {
  async getSkills() {
    return MOCK_SKILLS;
  }
}

export const mockSkillsSource = new MockSkillsSource();
