import { HOME_SOURCE_ID } from "./home";
import type { ScrapedRate } from "./types";
import { parseCentKantor } from "./scrapers/centkantor";
import { parseDorex } from "./scrapers/dorex";
import { parseKantorCentral } from "./scrapers/kantorcentral";
import { parseKantorKursDetal, parseKantorKursHurt } from "./scrapers/kantorkurs";
import { parseKantorPlex } from "./scrapers/kantorplex";
import { parseKantorSprawa } from "./scrapers/kantorsprawa";
import { parseKantorTukan } from "./scrapers/kantortukan";
import { parseKantorGant } from "./scrapers/kantorygant";
import { parseTavex } from "./scrapers/tavex";

export type Source = {
  id: string;
  name: string;
  url: string;
  parse: (html: string) => ScrapedRate[];
};

// Kolejne kantory: dopisz tu wpis + parser w lib/scrapers/.
// Kilka źródeł może dzielić ten sam URL — strona jest wtedy pobierana raz na scraping.
// Kolejność = kolejność kolumn na dashboardzie.

export const SOURCES: Source[] = [
  {
    id: HOME_SOURCE_ID,
    name: "Dorex",
    url: "https://www.dorex.com.pl/kursy-walut",
    parse: parseDorex,
  },
  {
    id: "centkantor",
    name: "Kantor CENT",
    url: "https://www.centkantor.pl/kursy-walut",
    parse: parseCentKantor,
  },
  {
    id: "kantorsprawa",
    name: "Kantor Sprawa",
    url: "https://kantorsprawa.pl/wroclaw",
    parse: (html) => parseKantorSprawa(html, "wroclaw"),
  },
  {
    id: "kantorcentral",
    name: "Kantor Central",
    url: "https://kantorcentral.pl/wroclaw/",
    parse: parseKantorCentral,
  },
  {
    id: "gant-olawska",
    name: "Kantor Gant",
    url: "https://www.kantorygant.pl/kantor/Wroclaw/Olawska-5",
    parse: parseKantorGant,
  },
  {
    id: "kantorkurs-detal",
    name: "Kantor KURS — detal",
    url: "https://kantorkurs.pl/wroclaw/",
    parse: parseKantorKursDetal,
  },
  {
    id: "kantorkurs-hurt",
    name: "Kantor KURS — hurt",
    url: "https://kantorkurs.pl/wroclaw/",
    parse: parseKantorKursHurt,
  },
  {
    id: "kantorplex-detal",
    name: "Kantor PLEX — detal",
    url: "https://kantorplex.pl/wroclaw-kurs-detal",
    parse: parseKantorPlex,
  },
  {
    id: "kantorplex-hurt",
    name: "Kantor PLEX — hurt",
    url: "https://kantorplex.pl/",
    parse: parseKantorPlex,
  },
  {
    id: "kantortukan",
    name: "Kantor Tukan — hurt",
    url: "https://kantortukan.pl/?lang=pl",
    parse: parseKantorTukan,
  },
  {
    id: "tavex-olawska",
    name: "Tavex",
    // officeId=61 = Wrocław, Oławska (bez parametru strona może pokazać inny oddział)
    url: "https://tavex.pl/kantor-wroclaw-kursy-walut/?officeId=61",
    parse: parseTavex,
  },
];
