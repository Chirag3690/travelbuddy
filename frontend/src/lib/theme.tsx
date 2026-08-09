import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/src/utils/storage";
import {
  type AppCopy,
  type DesignPreset,
  type ThemeColors,
  type ThemeMode,
  type VinciActionIcons,
  colorsFor,
  copyFor,
  actionIconsFor,
} from "@/src/lib/theme-presets";

const THEME_KEY = "tb_theme_mode";
const PRESET_KEY = "tb_design_preset";

export type { DesignPreset, ThemeMode, ThemeColors, AppCopy, VinciActionIcons } from "@/src/lib/theme-presets";
export {
  LEGACY_LIGHT,
  LEGACY_NIGHT,
  VINCI_LIGHT,
  VINCI_NIGHT,
  VINLE_BRAND,
  colorsFor,
  copyFor,
  getModes,
  actionIconsFor,
} from "@/src/lib/theme-presets";

type ThemeCtx = {
  mode: ThemeMode;
  preset: DesignPreset;
  colors: ThemeColors;
  copy: AppCopy;
  icons: VinciActionIcons;
  isNight: boolean;
  isVinci: boolean;
  /** Reserved — accent-stripe headers only (no full brand chrome bar). */
  brandChrome: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
  setPreset: (preset: DesignPreset) => Promise<void>;
  togglePreset: () => Promise<void>;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [preset, setPresetState] = useState<DesignPreset>("legacy");

  useEffect(() => {
    (async () => {
      const [savedMode, savedPreset] = await Promise.all([
        storage.getItem<ThemeMode>(THEME_KEY, "light"),
        storage.getItem<DesignPreset>(PRESET_KEY, "legacy"),
      ]);
      if (savedMode === "night" || savedMode === "light") setModeState(savedMode);
      if (savedPreset === "legacy" || savedPreset === "vinci") setPresetState(savedPreset);
    })();
  }, []);

  const setMode = async (next: ThemeMode) => {
    setModeState(next);
    await storage.setItem(THEME_KEY, next);
  };

  const setPreset = async (next: DesignPreset) => {
    setPresetState(next);
    await storage.setItem(PRESET_KEY, next);
  };

  const value = useMemo<ThemeCtx>(() => {
    const colors = colorsFor(preset, mode);
    const copy = copyFor(preset);
    const icons = actionIconsFor(preset);
    return {
      mode,
      preset,
      colors,
      copy,
      icons,
      isNight: mode === "night",
      isVinci: preset === "vinci",
      brandChrome: false,
      setMode,
      toggleMode: async () => setMode(mode === "night" ? "light" : "night"),
      setPreset,
      togglePreset: async () => setPreset(preset === "vinci" ? "legacy" : "vinci"),
    };
  }, [mode, preset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
