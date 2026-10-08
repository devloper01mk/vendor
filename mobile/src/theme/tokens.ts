/**
 * Design tokens — Notion-inspired workspace UI (cream canvas, ink sidebar, block surfaces).
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
    placeholder: "#9A9083",
    /** Strong ink for headings */
    primary: "#151515",
    ink: "#151515",
    /** Dark sidebar / active chrome (matches web) */
    sidebar: "#151515",
    sidebarElevated: "#1F1F1F",
    sidebarBorder: "#262626",
    sidebarText: "#E7E2D9",
    sidebarMuted: "#B8B1A6",
    sidebarAccent: "#C8B693",
    /** Primary actions, links, selected states */
    accent: "#C8B693",
    accentMuted: "#F3EDE3",
    onAccent: "#2A2A2A",
    /** Block hover / pressed surfaces */
    blockHover: "#F1F0ED",
    blockSelected: "#EFEEE9",
    positive: "#1F8A4D",
    positiveMuted: "#EAF5EE",
    negative: "#C93B3B",
    negativeMuted: "#F7F2EA",
    warning: "#8C7A5E",
    focus: "#C8B693",
    overlay: "rgba(21, 21, 21, 0.28)",
  },
  radius: {
    xs: 6,
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
      shadowColor: "#151515",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    elevated: {
      shadowColor: "#151515",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    fab: {
      shadowColor: "#151515",
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  },
} as const;
