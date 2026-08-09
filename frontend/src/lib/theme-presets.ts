export type DesignPreset = "legacy" | "vinci";
export type ThemeMode = "light" | "night";

export type ThemeColors = {
  bg: string;
  surface: string;
  elevated: string;
  primary: string;
  primaryHover: string;
  /** Soft brand tint for selected chips / pills (light mode). */
  primarySoft: string;
  /** Text & icons on solid primary buttons. */
  onPrimary: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  chipBg: string;
  inputBg: string;
};

/** Shared UI copy — same labels in classic and atelier (visual-only preset). */
export type AppCopy = {
  appTagline: string;
  loginHeadline: string;
  loginSubtitle: string;
  tabs: { discover: string; matches: string; chats: string; profile: string };
  tabIcons: {
    discover: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
    matches: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
    chats: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
    profile: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  };
  discoverPeople: string;
  discoverGroups: string;
  typePeople: string;
  typeSquads: string;
  createSquadTitle: string;
  createSquadSub: string;
  createSquadBtn: string;
  matchTitle: string;
  matchSub: string;
  matchKeepExploring: string;
  matchSayHi: string;
  buddiesTitle: string;
  buddiesSubEmpty: string;
  buddiesSub: (buddies: number, squads: number) => string;
  squadBtn: string;
  chatsTitle: string;
  chatsEmptyTitle: string;
  chatsEmptySub: string;
  sectionSquads: string;
  sectionPeople: string;
  sectionInvitations: string;
  sectionMySquads: string;
  buddiesEmptyTitle: string;
  buddiesEmptySub: string;
};

/** Vinle brand — Ocean Teal (maps, trails, departure boards — not dating-app warm tones). */
export const VINLE_BRAND = {
  ocean: "#0F766E",
  oceanDark: "#115E59",
  oceanSoft: "#E6F6F4",
  forest: "#166534",
  sky: "#0369A1",
  passportGold: "#CA8A04",
  ink: "#1A1D1F",
  mist: "#F4F5F7",
  slate: "#64748B",
} as const;

export const LEGACY_LIGHT: ThemeColors = {
  bg: VINLE_BRAND.mist,
  surface: "#FFFFFF",
  elevated: "#FFFFFF",
  primary: VINLE_BRAND.ocean,
  primaryHover: VINLE_BRAND.oceanDark,
  primarySoft: VINLE_BRAND.oceanSoft,
  onPrimary: "#FFFFFF",
  secondary: VINLE_BRAND.forest,
  accent: VINLE_BRAND.passportGold,
  textPrimary: VINLE_BRAND.ink,
  textSecondary: "#6B7280",
  border: "#E5E7EB",
  success: "#15803D",
  warning: "#CA8A04",
  error: "#B91C1C",
  chipBg: "#EEF0F3",
  inputBg: "#EEF0F3",
};

export const LEGACY_NIGHT: ThemeColors = {
  bg: "#0C0E12",
  surface: "#151820",
  elevated: "#1C2030",
  primary: "#5EEAD4",
  primaryHover: "#2DD4BF",
  primarySoft: "#134E4A",
  onPrimary: "#042F2E",
  secondary: "#4ADE80",
  accent: VINLE_BRAND.passportGold,
  textPrimary: "#F3F4F6",
  textSecondary: "#9CA3AF",
  border: "#2A2F3A",
  success: "#4ADE80",
  warning: "#FBBF24",
  error: "#F87171",
  chipBg: "#1F2430",
  inputBg: "#181C26",
};

/** Atlantis × Da Vinci: bioluminescent abyss, cyan glow, violet depth, amber relics */
export const VINCI_LIGHT: ThemeColors = {
  bg: "#0C2430",
  surface: "#143848",
  elevated: "#1B4A5E",
  primary: "#3DFFE8",
  primaryHover: "#2AD4C4",
  primarySoft: "#1A3D48",
  onPrimary: "#0C2430",
  secondary: "#9B7BFF",
  accent: "#FFB84D",
  textPrimary: "#E8FAFF",
  textSecondary: "#8EC8DC",
  border: "#2A6B82",
  success: "#4AE8B0",
  warning: "#FFB84D",
  error: "#FF7B6B",
  chipBg: "#1A4254",
  inputBg: "#123040",
};

export const VINCI_NIGHT: ThemeColors = {
  bg: "#020A12",
  surface: "#0A1828",
  elevated: "#102238",
  primary: "#6FFFF5",
  primaryHover: "#3DFFE8",
  primarySoft: "#0F2838",
  onPrimary: "#020A12",
  secondary: "#C9A0FF",
  accent: "#FFE566",
  textPrimary: "#F0FCFF",
  textSecondary: "#9BB8D0",
  border: "#1E3A52",
  success: "#5CFFD4",
  warning: "#FFE566",
  error: "#FF8F7A",
  chipBg: "#0F2840",
  inputBg: "#081828",
};

const APP_COPY: AppCopy = {
  appTagline: "For the wanderers",
  loginHeadline: "Find your\ntravel co-conspirator.",
  loginSubtitle:
    "Match with people heading to the same place, gig, or trail — and plan it together.",
  tabs: { discover: "Find", matches: "Buddies", chats: "Chats", profile: "Me" },
  tabIcons: { discover: "compass", matches: "people", chats: "chatbubbles", profile: "person" },
  discoverPeople: "Find a buddy",
  discoverGroups: "Find a squad",
  typePeople: "People",
  typeSquads: "Squads",
  createSquadTitle: "Start your own travel squad",
  createSquadSub: "Create a group others can discover and request to join.",
  createSquadBtn: "Create squad",
  matchTitle: "You're traveling together",
  matchSub: "You and {name} are both in.",
  matchKeepExploring: "Keep exploring",
  matchSayHi: "Say hi",
  buddiesTitle: "Your travel buddies",
  buddiesSubEmpty: "People and squads going where you're going",
  buddiesSub: (b, s) => `${b} buddies · ${s} squads`,
  squadBtn: "Squad",
  chatsTitle: "Messages",
  chatsEmptyTitle: "No chats yet",
  chatsEmptySub: "Match with someone or join a squad to start chatting.",
  sectionSquads: "Squads",
  sectionPeople: "People",
  sectionInvitations: "Squad invitations",
  sectionMySquads: "My squads",
  buddiesEmptyTitle: "No buddies yet",
  buddiesEmptySub: "Start swiping in Discover or create a squad.",
};

export function colorsFor(preset: DesignPreset, mode: ThemeMode): ThemeColors {
  if (preset === "vinci") return mode === "night" ? VINCI_NIGHT : VINCI_LIGHT;
  return mode === "night" ? LEGACY_NIGHT : LEGACY_LIGHT;
}

const VINCI_TAB_ICONS: AppCopy["tabIcons"] = {
  discover: "brush-outline",
  matches: "people-circle-outline",
  chats: "document-text-outline",
  profile: "color-palette-outline",
};

const VINCI_MODE_ICONS = {
  events: "color-wand-outline" as const,
  trips: "map-outline" as const,
  situationship: "sparkles-outline" as const,
};

type IonIcon = keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;

export type VinciActionIcons = {
  swipePass: IonIcon;
  swipeLike: IonIcon;
  filter: IonIcon;
  listView: IonIcon;
  createSquad: IonIcon;
};

const VINCI_ACTION_ICONS: VinciActionIcons = {
  swipePass: "close-circle-outline",
  swipeLike: "brush-outline",
  filter: "options-outline",
  listView: "albums-outline",
  createSquad: "add-circle-outline",
};

const LEGACY_ACTION_ICONS: VinciActionIcons = {
  swipePass: "close",
  swipeLike: "checkmark-circle",
  filter: "options-outline",
  listView: "albums-outline",
  createSquad: "add",
};

/** Same labels everywhere; tab/action icons change in atelier mode. */
export function copyFor(preset: DesignPreset = "legacy"): AppCopy {
  if (preset === "vinci") {
    return { ...APP_COPY, tabIcons: VINCI_TAB_ICONS };
  }
  return APP_COPY;
}

export function actionIconsFor(preset: DesignPreset): VinciActionIcons {
  return preset === "vinci" ? VINCI_ACTION_ICONS : LEGACY_ACTION_ICONS;
}

export function getModes(preset: DesignPreset = "legacy") {
  const icons =
    preset === "vinci"
      ? VINCI_MODE_ICONS
      : { events: "musical-notes" as const, trips: "map" as const, situationship: "compass" as const };
  return [
    { key: "events" as const, label: "Live Events", icon: icons.events },
    { key: "trips" as const, label: "Trips", icon: icons.trips },
    { key: "situationship" as const, label: "Open", icon: icons.situationship },
  ];
}
