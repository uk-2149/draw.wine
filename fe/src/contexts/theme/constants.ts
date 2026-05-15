import type { ThemeProviderState } from "./types";

export const defaultContextValue: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};
