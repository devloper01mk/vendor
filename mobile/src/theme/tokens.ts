/**
 * Design tokens — 8px grid, soft neutrals + single accent (fintech / productivity).
 */
export const tokens = {
  color: {
    background: "#F4F6F9",
    backgroundElevated: "#EEF2F7",
    panel: "#FFFFFF",
    panelMuted: "#F1F4F8",
    border: "#E2E8F0",
    borderStrong: "#CBD5E1",
    text: "#0B1220",
    muted: "#5C6B7A",
    /** Legacy: strong ink for headings — prefer `text` */
    primary: "#0B1220",
    /** Primary actions, links, selected states */
    accent: "#2563EB",
    accentMuted: "#EFF4FF",
    onAccent: "#FFFFFF",
    positive: "#0D7A5C",
    positiveMuted: "#E8F5F0",
    negative: "#C24141",
    negativeMuted: "#FEF2F2",
    warning: "#B45309",
    focus: "#2563EB",
    overlay: "rgba(11, 18, 32, 0.45)",
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  /** 8px grid */
  space: {
    0: 0,
    1: 8,
    2: 16,
    3: 24,
    4: 32,
    5: 40,
    /** Legacy aliases */
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  textSize: {
    hero: 28,
    title: 22,
    subtitle: 17,
    body: 15,
    small: 13,
    caption: 12,
  },
  /** @deprecated use textSize */
  text: {
    title: 22,
    subtitle: 17,
    body: 15,
    label: 12,
  },
  shadow: {
    card: {
      shadowColor: "#0B1220",
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    fab: {
      shadowColor: "#0B1220",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
  },
} as const;
