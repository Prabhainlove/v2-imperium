import type { ModuleColor, Rarity } from "./dashboard.data";

export const COLOR_VARS: Record<ModuleColor, { bg: string; fg: string; glow: string }> = {
  coral:    { bg: "#fde2d7", fg: "#ee7b5a", glow: "rgba(238,123,90,.35)" },
  mint:     { bg: "#d6efe9", fg: "#39a896", glow: "rgba(57,168,150,.30)" },
  lavender: { bg: "#e6dff6", fg: "#8c79c4", glow: "rgba(140,121,196,.30)" },
  butter:   { bg: "#fceeca", fg: "#cc9a1e", glow: "rgba(204,154,30,.30)" },
  sky:      { bg: "#d8ecf6", fg: "#3f93c0", glow: "rgba(63,147,192,.30)" },
  rose:     { bg: "#fbdada", fg: "#d75858", glow: "rgba(215,88,88,.30)" },
};

export const RARITY_RING: Record<Rarity, string> = {
  common:    "#cfd6dd",
  rare:      "#7fb8d8",
  epic:      "#b9a7e0",
  legendary: "#f5c452",
  mythic:    "#e76a6a",
};

export function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}
