import pkg from "../package.json";

/** Wersja aplikacji: 1.0.X, gdzie X to numer PR (podbijany w package.json w każdym PR). */
export const APP_VERSION: string = pkg.version;
