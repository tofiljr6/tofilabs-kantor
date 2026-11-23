export type ScrapedRate = {
  symbol: string;
  name: string;
  buy: number | null;
  sell: number | null;
};

export type RateSide = {
  value: number | null;
  /** Ostatnia wartość różna od bieżącej (podstawa do liczenia zmiany). */
  prev: number | null;
  /** Kiedy wartość ostatnio się zmieniła. */
  changedAt: string | null;
};

export type StoredRate = {
  symbol: string;
  name: string;
  buy: RateSide;
  sell: RateSide;
};

export type SourceSnapshot = {
  id: string;
  name: string;
  url: string;
  scrapedAt: string | null;
  error: string | null;
  rates: StoredRate[];
};

export type RatesState = {
  updatedAt: string | null;
  sources: Record<string, SourceSnapshot>;
};

export type HistoryPoint = { t: string; buy: number | null; sell: number | null };

export type SourceHistory = {
  id: string;
  name: string;
  url: string;
  /** Punkty zmian w oknie; pierwszy to kurs obowiązujący na początku okna (jeśli znany). */
  points: HistoryPoint[];
};

export type CurrencyHistory = {
  symbol: string;
  name: string;
  from: string;
  to: string;
  /** Do kiedy sięgają dane (teraz albo koniec okna). */
  until: string;
  sources: SourceHistory[];
};
