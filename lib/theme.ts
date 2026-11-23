// Motyw strony: ciemny (domyślny) albo jasny. Zapisany w localStorage przeglądarki
// i ustawiany na <html data-theme="…"> skryptem w <head>, zanim strona się narysuje (bez mignięcia).

export type Theme = "dark" | "light";
export const THEME_KEY = "kantor.theme";

/** Skrypt inline do <head> — działa na każdej podstronie, także na logowaniu. */
export const THEME_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // bez localStorage motyw obowiązuje tylko do przeładowania
  }
}
