// Symbol waluty (tak jak na stronach kantorów) → kod kraju ISO 3166-1 alpha-2 dla flagi.
// Uwaga: kantory używają też starych/własnych kodów (TRL, ROL, AZM, BYB, US1, *b = bilon).
const FLAG_BY_SYMBOL: Record<string, string> = {
  EUR: "eu", EUB: "eu", USD: "us", US1: "us", CHF: "ch", CHB: "ch", GBP: "gb", GBB: "gb",
  CZK: "cz", CZB: "cz", DKK: "dk", NOK: "no", SEK: "se", CAD: "ca", AUD: "au", JPY: "jp",
  TRL: "tr", TRY: "tr", RUB: "ru", HUF: "hu", AED: "ae", ALL: "al", AMD: "am", UAH: "ua",
  AZM: "az", AZN: "az", BAM: "ba", ROL: "ro", RON: "ro", BRL: "br", BYB: "by", BYN: "by",
  CLP: "cl", CNY: "cn", COP: "co", DOP: "do", EGP: "eg", GEL: "ge", HKD: "hk", IDR: "id",
  INR: "in", ILS: "il", ISK: "is", JOD: "jo", KES: "ke", KRW: "kr", KZT: "kz", LKR: "lk",
  MAD: "ma", MDL: "md", MKD: "mk", MUR: "mu", MVR: "mv", MXN: "mx", MYR: "my", NPR: "np",
  NZD: "nz", OMR: "om", PEN: "pe", PHP: "ph", RSD: "rs", SAR: "sa", SCR: "sc", SGD: "sg",
  THB: "th", TND: "tn", QAR: "qa", VND: "vn", ZAR: "za", TWD: "tw", PLN: "pl", BGN: "bg",
};

export function flagCode(symbol: string): string | null {
  return FLAG_BY_SYMBOL[symbol.toUpperCase()] ?? null;
}
