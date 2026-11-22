import type { ScrapedRate } from "./types";
import { parseCentKantor } from "./scrapers/centkantor";

export type Source = {
  id: string;
  name: string;
  url: string;
  parse: (html: string) => ScrapedRate[];
};

// Kolejne kantory: dopisz tu wpis + parser w lib/scrapers/.
export const SOURCES: Source[] = [
  {
    id: "centkantor",
    name: "Kantor CENT (Wrocław)",
    url: "https://www.centkantor.pl/kursy-walut",
    parse: parseCentKantor,
  },
];
