/**
 * Design tokens — 8px grid, soft neutrals + single accent (fintech / productivity).
 */
export const tokens = {
  color: {
    background: "#F6F3EE",
    backgroundElevated: "#FBF8F4",
    panel: "#FFFFFF",
    panelMuted: "#FBF8F4",
    border: "#E5DED3",
    borderStrong: "#D8CCBC",
    text: "#2A2A2A",
    muted: "#7A7A7A",
    /** Legacy: strong ink for headings — prefer `text` */
    primary: "#151515",
    /** Primary actions, links, selected states */
    accent: "#C8B693",
    accentMuted: "#F3EDE3",
    onAccent: "#2A2A2A",
    positive: "#2A2A2A",
    positiveMuted: "#F7F2EA",
    negative: "#C24141",
    negativeMuted: "#F7F2EA",
    warning: "#8C7A5E",
    focus: "#C8B693",
    overlay: "rgba(21, 21, 21, 0.28)",
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
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
      shadowColor: "#151515",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    fab: {
      shadowColor: "#151515",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  },
} as const;
