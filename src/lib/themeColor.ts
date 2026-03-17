export interface ThemeColor {
  dark: string;
  light: string;
}

export function resolveThemeColor(color: ThemeColor, theme: string): string {
  if (theme === "light") return color.light;
  return color.dark;
}
