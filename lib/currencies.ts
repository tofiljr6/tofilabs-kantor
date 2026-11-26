// Wspólny słownik walut: kanoniczny symbol → flaga (ISO 3166-1 alpha-2) + polska nazwa.
// Kantory używają różnych kodów dla tej samej waluty — ALIASES sprowadza je do jednego,
// żeby w tabeli ta sama waluta z różnych kantorów była w jednym wierszu.

/** Stare / niestandardowe kody → kod kanoniczny. */
const ALIASES: Record<string, string> = {
  TRL: "TRY", // stara lira turecka
  ROL: "RON", // stary lej rumuński
  AZM: "AZN", // stary manat azerski
  BYB: "BYN", // stary rubel białoruski
  EURB: "EUB", // Gant: euro monety
  NEW: "USN", // Central, Sprawa: dolar — nowe banknoty (od 2009)
  "1US": "US1", // Sprawa: dolar — nominały 1$, 2$
  USDJ: "US1", // Gant: dolar — nominały 1$, 2$, 5$
  USD1: "US1", // Plex: dolar — "jedynki"
  USDN: "US1", // Tavex: dolar — banknoty 1, 2, 5 USD
  EURC: "EUB", // Tavex: euro — bilon
  GBPB: "GBB", // Dorex: funt — bilon
  CHFB: "CHB", // Dorex: frank — bilon
  CZKB: "CZB", // Dorex: korona czeska — bilon
};

export function canonicalSymbol(raw: string): string {
  const s = raw.trim().toUpperCase(); // EUb → EUB, GBb → GBB itd.
  return ALIASES[s] ?? s;
}

type Info = [flag: string | null, name: string];

const CURRENCIES: Record<string, Info> = {
  EUR: ["eu", "Euro"],
  EUB: ["eu", "Euro — bilon"],
  USD: ["us", "Dolar amerykański"],
  USN: ["us", "Dolar amerykański — nowe banknoty (od 2009)"],
  US1: ["us", "Dolar amerykański — małe nominały"],
  USO: ["us", "Dolar amerykański — stare banknoty (do 2007)"],
  USM: ["us", "Dolar amerykański — małe głowy"],
  USH: ["us", "Dolar amerykański — duże głowy"],
  USA: ["us", "Dolar amerykański — bilon"],
  GBP: ["gb", "Funt brytyjski"],
  GBB: ["gb", "Funt brytyjski — bilon"],
  CHF: ["ch", "Frank szwajcarski"],
  CHB: ["ch", "Frank szwajcarski — bilon"],
  CZK: ["cz", "Korona czeska"],
  CZB: ["cz", "Korona czeska — bilon"],
  DKK: ["dk", "Korona duńska"],
  NOK: ["no", "Korona norweska"],
  SEK: ["se", "Korona szwedzka"],
  ISK: ["is", "Korona islandzka"],
  CAD: ["ca", "Dolar kanadyjski"],
  AUD: ["au", "Dolar australijski"],
  NZD: ["nz", "Dolar nowozelandzki"],
  HKD: ["hk", "Dolar hongkoński"],
  SGD: ["sg", "Dolar singapurski"],
  TWD: ["tw", "Dolar tajwański"],
  JMD: ["jm", "Dolar jamajski"],
  BSD: ["bs", "Dolar bahamski"],
  XCD: [null, "Dolar wschodniokaraibski"],
  JPY: ["jp", "Jen japoński"],
  CNY: ["cn", "Juan chiński"],
  KRW: ["kr", "Won południowokoreański"],
  HUF: ["hu", "Forint węgierski"],
  RON: ["ro", "Lej rumuński"],
  MDL: ["md", "Lej mołdawski"],
  BGN: ["bg", "Lew bułgarski"],
  TRY: ["tr", "Lira turecka"],
  RUB: ["ru", "Rubel rosyjski"],
  BYN: ["by", "Rubel białoruski"],
  UAH: ["ua", "Hrywna ukraińska"],
  GEL: ["ge", "Lari gruzińskie"],
  AMD: ["am", "Dram armeński"],
  AZN: ["az", "Manat azerski"],
  KZT: ["kz", "Tenge kazachskie"],
  ALL: ["al", "Lek albański"],
  BAM: ["ba", "Marka BiH"],
  MKD: ["mk", "Denar macedoński"],
  RSD: ["rs", "Dinar serbski"],
  AED: ["ae", "Dirham ZEA"],
  SAR: ["sa", "Rial saudyjski"],
  QAR: ["qa", "Rial katarski"],
  OMR: ["om", "Rial omański"],
  KWD: ["kw", "Dinar kuwejcki"],
  BHD: ["bh", "Dinar bahrajński"],
  JOD: ["jo", "Dinar jordański"],
  ILS: ["il", "Szekel izraelski"],
  EGP: ["eg", "Funt egipski"],
  MAD: ["ma", "Dirham marokański"],
  TND: ["tn", "Dinar tunezyjski"],
  ZAR: ["za", "Rand południowoafrykański"],
  KES: ["ke", "Szyling kenijski"],
  UGX: ["ug", "Szyling ugandyjski"],
  TZS: ["tz", "Szyling tanzański"],
  BWP: ["bw", "Pula botswańska"],
  GMD: ["gm", "Dalasi gambijskie"],
  MUR: ["mu", "Rupia maurytyjska"],
  SCR: ["sc", "Rupia seszelska"],
  CVE: ["cv", "Escudo Zielonego Przylądka"],
  INR: ["in", "Rupia indyjska"],
  NPR: ["np", "Rupia nepalska"],
  LKR: ["lk", "Rupia lankijska"],
  MVR: ["mv", "Rufiyaa malediwska"],
  IDR: ["id", "Rupia indonezyjska"],
  THB: ["th", "Baht tajski"],
  VND: ["vn", "Dong wietnamski"],
  MYR: ["my", "Ringgit malezyjski"],
  PHP: ["ph", "Peso filipińskie"],
  KHR: ["kh", "Riel kambodżański"],
  LAK: ["la", "Kip laotański"],
  MOP: ["mo", "Pataca Makau"],
  PGK: ["pg", "Kina papuaska"],
  VUV: ["vu", "Vatu vanuackie"],
  XPF: ["pf", "Frank CFP"],
  MXN: ["mx", "Peso meksykańskie"],
  BRL: ["br", "Real brazylijski"],
  CLP: ["cl", "Peso chilijskie"],
  COP: ["co", "Peso kolumbijskie"],
  PEN: ["pe", "Sol peruwiański"],
  DOP: ["do", "Peso dominikańskie"],
  PLN: ["pl", "Złoty polski"],
};

/**
 * Kolejność walut dokładnie jak na dorex.com.pl/kursy-walut (kanoniczne symbole).
 * Waluty spoza listy trafiają na koniec, alfabetycznie.
 */
export const DOREX_ORDER: string[] = [
  "EUR", "USD", "GBP", "CHF", "SEK", "CZK", "HUF", "AUD", "DKK", "JPY",
  "CAD", "NOK", "MYR", "NZD", "RON", "RSD", "SGD", "THB", "TND", "TRY",
  "UAH", "ZAR", "MXN", "MKD", "MAD", "DOP", "BRL", "CNY", "BAM", "ALL",
  "AED", "BGN", "RUB", "EGP", "GEL", "HKD", "KRW", "JOD", "ISK", "INR",
  "ILS", "IDR", "QAR", "EUB", "GBB", "CHB", "CZB", "US1", "KZT", "KES",
  "CLP", "PEN", "PHP", "SAR", "VND", "JMD",
];

/** Czy symbol jest w słowniku (odsiewa wycofane waluty typu DEM, ATS, stare banknoty itp.). */
export function isKnownCurrency(symbol: string): boolean {
  return canonicalSymbol(symbol) in CURRENCIES;
}

export function flagCode(symbol: string): string | null {
  return CURRENCIES[canonicalSymbol(symbol)]?.[0] ?? null;
}

/** Ujednolicona nazwa waluty; gdy brak w słowniku — nazwa podana przez kantor. */
export function currencyName(symbol: string, fallback: string): string {
  return CURRENCIES[canonicalSymbol(symbol)]?.[1] ?? fallback;
}
