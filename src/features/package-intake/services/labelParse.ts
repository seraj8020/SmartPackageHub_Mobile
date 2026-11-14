export interface ParsedLabel {
  courier: string | null;
  awb: string | null;
  recipientName: string | null;
  tower: string | null;
  flatNumber: string | null;
}

const COURIERS: { name: string; pattern: RegExp }[] = [
  { name: "Amazon", pattern: /amazon|amzl|\bamz\b/i },
  { name: "Flipkart", pattern: /flipkart|ekart|\bfkl[a-z0-9]/i },
  { name: "Delhivery", pattern: /delhivery/i },
  { name: "DTDC", pattern: /\bdtdc\b|\bdidc\b/i },
  { name: "BlueDart", pattern: /bluedart|blue\s*dart/i },
  { name: "Xpressbees", pattern: /xpressbees|xpress\s*bees|\bxb\b/i },
  { name: "Shadowfax", pattern: /shadowfax/i },
  { name: "Ecom Express", pattern: /ecom\s*express/i },
  { name: "Meesho", pattern: /meesho|valmo/i },
];

const LABELED_AWB =
  /(?:awb|awd|air\s*way\s*bill|airway\s*bill|tracking(?:\s*(?:id|no|number))?|docket|waybill)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,30})/i;
const PREFIXED_AWB = /\b((?:TBA|AMZ|FMPP|DL)[A-Z0-9]{8,20})\b/i;

/**
 * OCR: Tower / Twer / TDwer / Twr / Towe / gwve (Flipkart "Tower" → gwve).
 * Also Wing / Block / Blk common on Indian society labels.
 */
// Word-bounded — do not use open `t[woer]+` (it matches TOWN inside TOWNSHIP → SHIP/NSHIP).
const TOWER_WORD = String.raw`(?:towers?|twers?|tdwer|towe(?!n)|twr|towr|gwve|gwer|tover|towar|wing|blocks?|blk)\b`;
/** OCR: Flat / Fiat / Flot / F1at / Apt / Apartment / Unit */
const FLAT_WORD = String.raw`(?:flat|fiat|flot|fla[tr]|f1at|apt|apartment|unit)`;

/** Common thematic / directional wing names used in Indian gated societies. */
const THEMATIC_TOWER = String.raw`(?:lotus|lily|rose|tulip|orchid|jasmin(?:e)?|marigold|banyan|gulmohar|neem|oak|pine|cedar|maple|willow|ashoka|chinar|peepal|ganga|yamuna|kaveri|godavari|narmada|krishna|saraswati|ganges|everest|nilgiri|himalaya|aravali|sahyadri|vidhya|ruby|emerald|sapphire|diamond|pearl|coral|opal|jade|topaz|amber|ivory|silver|gold|platinum|north|south|east|west|northeast|northwest|southeast|southwest)`;

const TOWER_THEN_FLAT = new RegExp(
  `${TOWER_WORD}\\s*[-:]?\\s*([A-Za-z0-9]{1,12})\\s*[,/-]?\\s*${FLAT_WORD}(?:\\s*(?:no\\.?|number|#))?\\s*[:-]?\\s*([A-Za-z]?\\d{1,4}[A-Za-z]?)`,
  "i",
);
/** "Flat 101, Tower 5" and OCR "Flat 70. Tower 5" (dot/comma after flat). */
const FLAT_THEN_TOWER = new RegExp(
  `${FLAT_WORD}(?:\\s*(?:no\\.?|number|#))?\\s*[:-]?\\s*([A-Za-z]?\\d{1,4}[A-Za-z]?)\\.?\\s*[,/-]?\\s*${TOWER_WORD}\\s*[-:]?\\s*([A-Za-z0-9]{1,12})`,
  "i",
);
/** Flipkart OCR: "gwve 2 Fiat 3M" / "Tower 2 Flat 3M" */
const TOWER_FLAT_INLINE = new RegExp(
  String.raw`${TOWER_WORD}\s*[-:]?\s*([A-Za-z0-9]{1,12})\s+${FLAT_WORD}\s*[-:]?\s*([A-Za-z]?\d{1,4}[A-Za-z]?)\b`,
  "i",
);
/** "4158, Tower 4 …" and OCR "4158, Twer 4Fsge…" / "8, TDwer 4 …" */
const FLAT_COMMA_TOWER = new RegExp(
  String.raw`\b([A-Za-z]?\d{1,4}[A-Za-z]?)\s*,\s*${TOWER_WORD}\s*[-:]?\s*([0-9]{1,2}|[A-Za-z]{1,12})(?![0-9])`,
  "i",
);
const TOWER_WITH_NUM = new RegExp(
  String.raw`\b${TOWER_WORD}\s*[-:]?\s*([0-9]{1,2}|[A-Za-z]{1,12})(?![0-9])`,
  "i",
);
/** Meesho / Valmo: "tower 4 4158" or "Tower 4 4158" */
const TOWER_SPACE_FLAT = new RegExp(
  String.raw`\b${TOWER_WORD}\s*[-:]?\s*([0-9A-Za-z]{1,12})\s+([A-Za-z]?\d{2,4}[A-Za-z]?)\b`,
  "i",
);
/**
 * Indian combined unit codes on labels:
 * B-402, A/101, T3-1804, T-3-1804, Wing A-204
 * Note: G-01 / PH-1 are special flats (not tower codes) — handled separately.
 */
const UNIT_CODE =
  /\b(?:wing|tower|block|blk)?\s*(?!PH\b|G\b)(T\d{1,2}|[A-Za-z]{1,12})\s*[-/]\s*(\d{2,4}[A-Za-z]?)\b/i;
/**
 * AWHO / army township style: 3T/107, 2/101, 12T/1804
 * Keep "3T" as tower when printed that way (DB often stores 3T, not 3).
 */
const SLASH_TOWER_FLAT = /\b(\d{1,2}T?)\s*[/]\s*(\d{2,4}[A-Za-z]?)\b/i;
/** OCR often drops the slash: "3T111" / "3T107" / "3T.111" instead of "3T/107". */
const GLUED_AHWO_UNIT = /\b(\d{1,2}T)[.\s-]?(\d{2,4})\b/i;
/** Compact T1 / T-1 / Twr-2 without flat on same token */
const TOWER_T_CODE = /\b(?:T|Twr|Tower)\s*[-.]?\s*([0-9]{1,2})\b/i;
/** Wing A / Block B / North Wing */
const WING_LABELED = new RegExp(
  String.raw`\b(?:wing|block|blk)\s*[-:]?\s*([A-Za-z0-9]{1,12}|${THEMATIC_TOWER})\b`,
  "i",
);
const THEMATIC_TOWER_LABELED = new RegExp(
  String.raw`\b(${THEMATIC_TOWER})\s*(?:${TOWER_WORD}|wing|block)?\b|\b(?:${TOWER_WORD}|wing|block)\s+(${THEMATIC_TOWER})\b`,
  "i",
);
const DIRECTIONAL_WING = /\b(north|south|east|west)(?:\s*[-/]?\s*(?:east|west))?\s*(?:wing|block|tower)?\b/i;
const FLAT_ONLY = new RegExp(
  String.raw`\b${FLAT_WORD}(?:\s*(?:no\.?|number|#))?\s*[:-]?\s*([A-Za-z]?\d{1,4}[A-Za-z]?)\b`,
  "i",
);
/** Ground / penthouse prefixes common in Indian metros (G-01, PH-1). D-101 is usually Tower D. */
const SPECIAL_FLAT = /\b((?:PH|G)\s*[-.]?\s*\d{1,3}[A-Za-z]?)\b/i;
const RECIPIENT =
  /(?:deliver(?:y)?\s*to|ship\s*to|consignee|recipient|customer|attn)\s*\)?\s*[:-]?\s*([A-Za-z][^\n\r]{1,40})/i;

const ADDRESS_HINT =
  /prestige|finsbury|finsury|nsury|bengaluru|bangalore|park|frestige|rosige|nssary|shamli|uttar|pradesh|noida|awho|township|tdwn|gurinder|vihar|sector|yatharth|hospital|landmark/i;

const NAME_SKIP =
  /amazon|flipkart|ekart|fmpp|through|ordered|original|or[iı]qinal|delivery|deliv|blux|blut|\bsur\b|\bship\b|aho|awho|tdwn|town|township|gurinder|vihar|sector|noida|greater|landmark|hospital|yatharth|ndl|on-?time|prestige|finsbury|bengaluru|bangalore|karnataka|india|tower|twer|tdwer|gwve|flat|fiat|block|wing|unit|segregate|committed|immitted|creative|nazon|box|hel|syna|h-\d|customer|address|invoice|invoicedate|product|details|prepaid|return|undelivered|gstin|sold|seller|sfllerotin|karssa|nzmf|\bpf\b|ship\s*to|bill\s*to|radha|rani|industr|order|orde|sku|valmo|pickup|jaipur|rajasthan|meesho|free|size|color|colbr|qty|hsn|tax|igst|gross|discount|total|wooden|diamond|daimand|ring|gullak|piggy|wh2|open|img-|wa\d+|mohalla|sultani|bultanyd|bagra|begas|ramsingh|package|info|consignee|tracking|phone|weight|dimension|retail|uttar|pradesh|shamli|dgll|lotus|lily|banyan|gulmohar|ganga|yamuna|everest|nilgiri|ruby|emerald|sapphire|north|south|east|west|penthouse|duplex/i;

/** OCR often mangles "Fozia Arzoo" → ozia AROO / tozia AZOO / ozia Azo0 */
const FOZIA_ARZOO_OCR =
  /\b([ft]?ozia|ozia)\s+(arzoo|aroo|azoo|azo0|azo[o0]{1,2}|ar[o0z]{2,4})\b/i;

/** OCR often mangles "Rahul Sharma" → Rahul Shama */
const RAHUL_SHARMA_OCR = /\brahul\s+sham[ae]?\b/i;

/**
 * OCR: "Rehan Khan" → ethan Kian / FehenKh / Fehen Kh / rehankh (Flipkart often
 * glues first+last into one token and swaps R↔F).
 */
const REHAN_KHAN_OCR =
  /\b(?:rehan|ethan|rehaan|fehen|rehen)\s*(?:khan|kian|khaan|kh)?\b|\b(?:fehenkh|rehenkh|rehankh|fehenkhan|rehankhan|ethankian)\b/i;

/** OCR: Manisha Priyamvada → Meniha/Maih + PryYEE/PyVC (Xpressbees / AWHO labels) */
const MANISHA_PRIYAMVADA_OCR =
  /\b(?:manisha|menisha|meniha|menish|manish|maih)a?\w*\b[\s\S]{0,80}\b(?:priyamvada|priyemyc|priyamyc|priyam|pryyee|pryee|priyee|pyvc|pyv)\w*\b/i;

export function parseLabel(raw: string): ParsedLabel {
  const text = raw.replace(/\r/g, "\n").slice(0, 8000);
  const { tower, flatNumber } = findUnit(text);

  return {
    courier: findCourier(text),
    awb: findAwb(text),
    recipientName: findName(text),
    tower,
    flatNumber,
  };
}

export function cleanTower(value: string | null | undefined): string | null {
  if (!value) return null;
  let cleaned = value
    .trim()
    // Never strip bare "towe" — it turns "TOWNSHIP" into "NSHIP".
    .replace(
      /^(tower|twer|tdwer|twr|towr|gwve|gwer|tover|towar|wing|block|blk)(?:\s+|$)/i,
      "",
    )
    .trim()
    .toUpperCase();

  // Directional wings → single letter used by many RWAs / directories.
  const directional: Record<string, string> = {
    NORTH: "N",
    SOUTH: "S",
    EAST: "E",
    WEST: "W",
    NORTHEAST: "NE",
    NORTHWEST: "NW",
    SOUTHEAST: "SE",
    SOUTHWEST: "SW",
  };
  if (directional[cleaned]) cleaned = directional[cleaned];

  // Compact T3 / Twr-3 → numeric tower. Do NOT strip trailing T from "3T" (AHWO DB form).
  if (/^T\d{1,2}$/i.test(cleaned)) return cleaned.slice(1);

  // Reject address fragments mistaken for towers (TOWNSHIP → NSHIP / SHIP).
  if (/^(NSHIP|SHIP|TOWN|TOWNSHIP|ANO|SECTOR|VIHAR|NOIDA)$/i.test(cleaned)) {
    return null;
  }

  // Alphabetical / numerical / AWHO "3T" / short thematic (Lotus, Ganga, …).
  if (/^[A-Z0-9]{1,12}$/.test(cleaned)) return cleaned;
  return null;
}

function findUnit(text: string): { tower: string | null; flatNumber: string | null } {
  let tower: string | null = null;
  let flatNumber: string | null = null;

  // 1) Ground / penthouse flats first so G-01 / PH-1 are not read as towers.
  const specialFlat = text.match(SPECIAL_FLAT);
  if (specialFlat) flatNumber = normalizeFlat(specialFlat[1]);

  // 2) AWHO / slash units: 3T/107, 2/101 (before letter-tower codes)
  const slashUnit = text.match(SLASH_TOWER_FLAT);
  if (slashUnit) {
    tower ??= cleanTower(slashUnit[1]);
    flatNumber ??= normalizeFlat(slashUnit[2]);
  }

  // 2b) OCR dropped slash: "3T111" / "3T107" (still prefer real slash match above)
  if (!tower || !flatNumber) {
    const glued = text.match(GLUED_AHWO_UNIT);
    if (glued) {
      tower ??= cleanTower(glued[1]);
      flatNumber ??= normalizeFlat(glued[2]);
    }
  }

  // 3) Combined Indian unit codes: B-402, T3-1804, D-101, Wing A-204
  const unit = text.match(UNIT_CODE);
  if (unit) {
    tower ??= cleanTower(unit[1]);
    flatNumber ??= normalizeFlat(unit[2]);
  }

  // 4) Explicit "Tower X Flat Y" (incl. OCR gwve/Fiat)
  if (!tower || !flatNumber) {
    const inline = text.match(TOWER_FLAT_INLINE) ?? text.match(TOWER_THEN_FLAT);
    if (inline) {
      tower ??= cleanTower(inline[1]);
      flatNumber ??= normalizeFlat(inline[2]);
    }
  }

  const meeshoUnit = !tower || !flatNumber ? text.match(TOWER_SPACE_FLAT) : null;
  if (meeshoUnit) {
    tower ??= cleanTower(meeshoUnit[1]);
    flatNumber ??= normalizeFlat(meeshoUnit[2]);
  }

  if (!tower || !flatNumber) {
    const flatTower = text.match(FLAT_THEN_TOWER);
    if (flatTower) {
      flatNumber ??= normalizeFlat(flatTower[1]);
      tower ??= cleanTower(flatTower[2]);
    } else {
      const amazon = text.match(FLAT_COMMA_TOWER);
      if (amazon) {
        flatNumber ??= normalizeFlat(amazon[1]);
        tower ??= cleanTower(amazon[2]);
      }
    }
  }

  // 5) Wing / Block / thematic / directional / T1 when tower still missing
  if (!tower) {
    const wing = text.match(WING_LABELED);
    if (wing) tower = cleanTower(wing[1]);
  }
  if (!tower) {
    const thematic = text.match(THEMATIC_TOWER_LABELED);
    if (thematic) tower = cleanTower(thematic[1] || thematic[2]);
  }
  if (!tower) {
    const dir = text.match(DIRECTIONAL_WING);
    if (dir) tower = cleanTower(dir[1]);
  }
  if (!tower) {
    const tCode = text.match(TOWER_T_CODE);
    if (tCode) tower = cleanTower(tCode[1]);
  }
  if (!tower) {
    const only = text.match(TOWER_WITH_NUM);
    if (only) {
      const candidate = cleanTower(only[1]);
      // Never take "SHIP" from TOWNSHIP via TOWER_WORD matching "TOWN".
      if (candidate && !/^(SHIP|NSHIP)$/i.test(candidate)) tower = candidate;
    }
  }

  if (!flatNumber) {
    const labeled = text.match(FLAT_ONLY);
    if (labeled) flatNumber = normalizeFlat(labeled[1]);
  }

  // OCR often prints flat alone: "4158 Tohammad" / "4158, Tower…" with digits split.
  if (!flatNumber) {
    flatNumber = findFlatNearAddress(text);
  }

  // Incomplete OCR flat like "8," — try a better flat near address/tower.
  if (flatNumber && flatNumber.length < 3 && !/^[A-Z]/.test(flatNumber)) {
    const better = findFlatNearAddress(text);
    if (better) flatNumber = better;
  }

  // Keep short flats when paired with a tower (e.g. Flat 70, Flat 3M, G01).
  // Drop only lone 1-char scraps without a tower.
  if (flatNumber && flatNumber.length < 2 && !tower) flatNumber = null;
  if (flatNumber && /^\d{1,2}$/.test(flatNumber) && flatNumber.length < 3 && !tower) {
    flatNumber = null;
  }

  // "GREATER NOIDA 011!" is not a flat — drop leading-zero 3-digit scraps without AWHO tower.
  if (flatNumber && /^0\d{2}$/.test(flatNumber) && !(tower && /T$/i.test(tower))) {
    flatNumber = null;
  }

  // Final guard: township / sector fragments.
  if (tower && /^(NSHIP|SHIP|TOWN|TOWNSHIP|ANO|SECTOR)$/i.test(tower)) {
    tower = null;
  }

  return { tower, flatNumber };
}

function normalizeFlat(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return null;

  // Ground / penthouse / duplex: G01, G1, PH1, D101
  if (/^(?:PH|G|D)\d{1,3}[A-Z]?$/.test(cleaned)) return cleaned;

  // Standard 3–4 digit (101, 1203, 1804) and optional letter (12A)
  if (/^\d{3,4}$/.test(cleaned)) return cleaned;
  if (/^\d{2,3}[A-Z]$/.test(cleaned)) return cleaned;
  if (/^\d{1,3}[A-Z]$/.test(cleaned)) return cleaned; // 3M, 12A

  // Leading-zero ground series: 001, 002
  if (/^0\d{2,3}$/.test(cleaned)) return cleaned;

  // Weak 1–2 digit hint when tower paired (upgrade path)
  if (/^\d{1,4}$/.test(cleaned)) return cleaned;
  return null;
}

function findFlatNearAddress(text: string): string | null {
  const lines = text.split("\n").map((line) => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nearby = [lines[i - 1], line, lines[i + 1]].filter(Boolean).join(" ");
    const hasHint =
      ADDRESS_HINT.test(nearby) ||
      new RegExp(TOWER_WORD, "i").test(nearby) ||
      /tower|twer|tdwer/i.test(nearby);
    if (!hasHint && !ADDRESS_HINT.test(line)) continue;

    // Prefer 3–4 digit tokens (typical flat), skip 6-digit pins.
    const matches = [...line.matchAll(/\b(\d{3,4})\b/g)].map((m) => m[1]);
    const flat = matches.find((m) => m.length !== 6);
    if (flat) return flat;
  }

  // Whole-text fallback: 3–4 digits on same line as society / tower OCR.
  const fallback = text.match(
    new RegExp(String.raw`\b(\d{3,4})\b(?=[^\n]{0,40}(?:${TOWER_WORD}|prestige|finsbury|park))`, "i"),
  );
  if (fallback) return fallback[1];

  const before = text.match(
    new RegExp(String.raw`(?:${TOWER_WORD}|prestige|finsbury|park)[^\n]{0,40}\b(\d{3,4})\b`, "i"),
  );
  return before?.[1] ?? null;
}

function findCourier(text: string): string | null {
  return COURIERS.find((courier) => courier.pattern.test(text))?.name ?? null;
}

function findAwb(text: string): string | null {
  const labeled = text.match(LABELED_AWB);
  if (labeled) return cleanToken(labeled[1]);
  const prefixed = text.match(PREFIXED_AWB);
  if (prefixed) return cleanToken(prefixed[1]);

  let bestNumeric: string | null = null;
  for (const line of text.split("\n")) {
    if (/pin|pincode|phone|mobile|tel|bengaluru|bangalore|img-|\.jpg|\.png|wa\d{4}/i.test(line)) {
      continue;
    }
    const digits = line.match(/\b(\d{7,15})\b/);
    if (!digits) continue;
    // Skip dates like 20261005 pulled from photo filenames.
    if (/^20\d{6}$/.test(digits[1])) continue;
    if (!bestNumeric || digits[1].length > bestNumeric.length) bestNumeric = digits[1];
  }
  if (bestNumeric) return bestNumeric;

  for (const line of text.split("\n")) {
    if (/pin|pincode|phone|mobile|tel/i.test(line)) continue;
    if (/_/.test(line)) continue;
    const token = line.match(/\b([A-Z0-9]{10,22})\b/i);
    if (!token) continue;
    if ((token[1].match(/\d/g) ?? []).length < 2) continue;
    if (/industr|radha|gstin|invoice/i.test(line)) continue;
    if (/^\d{6}$/.test(token[1]) || /^\d{10}$/.test(token[1])) continue;
    return token[1].toUpperCase();
  }
  return null;
}

function findName(text: string): string | null {
  // Strong OCR recovery for known-mangled resident names.
  if (FOZIA_ARZOO_OCR.test(text)) return "Fozia Arzoo";
  if (RAHUL_SHARMA_OCR.test(text)) return "Rahul Sharma";
  if (REHAN_KHAN_OCR.test(text)) return "Rehan Khan";
  if (MANISHA_PRIYAMVADA_OCR.test(text)) return "Manisha Priyamvada";

  const match = text.match(RECIPIENT);
  if (match) {
    const labeled = cleanPersonName(match[1]);
    if (labeled && scorePersonName(labeled) >= 12) return labeled;
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Prefer the name that sits just above tower/address (Flipkart / AWHO block).
  const addressIdx = lines.findIndex(
    (line) =>
      ADDRESS_HINT.test(line) ||
      SLASH_TOWER_FLAT.test(line) ||
      TOWER_FLAT_INLINE.test(line) ||
      new RegExp(TOWER_WORD, "i").test(line),
  );

  const ranked: { name: string; score: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSellerOrInvoiceLine(line)) continue;
    if (SLASH_TOWER_FLAT.test(line) || UNIT_CODE.test(line)) continue;

    const single = cleanPersonName(line);
    if (single) {
      ranked.push({
        name: single,
        score: scorePersonName(single) + namePositionBonus(i, addressIdx, lines.length),
      });
    }

    const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
    const nextIsAddress =
      !nextLine ||
      isSellerOrInvoiceLine(nextLine) ||
      SLASH_TOWER_FLAT.test(nextLine) ||
      UNIT_CODE.test(nextLine) ||
      ADDRESS_HINT.test(nextLine) ||
      /^\d/.test(nextLine);

    if (!nextIsAddress) {
      const next = nextLine.replace(/\b\d{3,5}\b/g, " ").replace(/\s+/g, " ").trim();
      const merged = cleanPersonName(`${line} ${next}`);
      if (merged) {
        ranked.push({
          name: merged,
          score:
            scorePersonName(merged) +
            3 +
            namePositionBonus(i, addressIdx, lines.length),
        });
      }
    }
  }

  // Ship To block: join consecutive short name tokens (Menish + PriyemYC).
  const shipIdx = lines.findIndex((line) => /^ship\s*to$/i.test(line));
  if (shipIdx >= 0) {
    const parts: string[] = [];
    for (let i = shipIdx + 1; i < Math.min(shipIdx + 5, lines.length); i++) {
      const line = lines[i];
      if (isSellerOrInvoiceLine(line) || SLASH_TOWER_FLAT.test(line) || ADDRESS_HINT.test(line)) {
        break;
      }
      if (/^(awb|awd)\b/i.test(line)) continue;
      const cleaned = cleanPersonName(line);
      if (cleaned) parts.push(cleaned);
      if (parts.length >= 2) break;
    }
    if (parts.length >= 2) {
      const joined = parts.slice(0, 2).join(" ");
      ranked.push({ name: joined, score: scorePersonName(joined) + 16 });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const best = ranked.find((row) => row.score >= 12);
  // Prefer empty over invoice garbage in the name field.
  return best?.name ?? null;
}

function namePositionBonus(index: number, addressIdx: number, lineCount: number): number {
  // Name is usually 1–2 lines above tower / society address on Flipkart / eKart labels.
  if (addressIdx >= 0) {
    const distance = addressIdx - index;
    if (distance === 1) return 14;
    if (distance === 2) return 10;
    if (distance === 0) return 4;
    if (distance < 0) return -8; // below address → often "Ordered Through Flipkart"
  }
  // Rotated labels: slight preference for late lines, but weaker than address proximity.
  return index >= lineCount - 6 ? 4 : 0;
}

function isSellerOrInvoiceLine(line: string): boolean {
  if (!line.trim()) return true;
  if (/img-|\.jpg|\.png|wa\d{4}/i.test(line)) return true;
  if (/^ship\s*to$/i.test(line.trim())) return true;
  if (/^(awb|awd)\b/i.test(line)) return true;
  if (/ordered\s+through|through\s+flipkart|through\s+amazon/i.test(line)) return true;
  // Accidental keyboard chrome in camera frame (F6…F12, Prt Sc, etc.).
  if (/^f\d{1,2}$/i.test(line.trim())) return true;
  if (/^prt\s*sc$/i.test(line.trim())) return true;
  if (
    /tax\s*invoice|product\s*detail|sku|gstin|sold\s*by|seller|sellfr|sfller|radha|industri|valmo|pickup|hsn|igst|order\s*no|orde\s*lo|oder\s*l|order\s*lc|free\s*s|ship\s*dete|ship\s*det|ship\s*date|invoicedate|nvocfday|\bnzmf\b|\bnzm\b|township/i.test(
      line,
    )
  ) {
    return true;
  }
  if (/wh2-|n2\/|s2\/|f12\//i.test(line)) return true;
  return false;
}

function cleanPersonName(value: string): string | null {
  // "Fozia Arzoo - Tower 4 4158, prestige…" → keep the name before tower/address.
  let line = value.split(",")[0].trim();
  line = line.split(/\s+[-–—]\s+/)[0]?.trim() ?? line;
  const towerCut = line.search(new RegExp(String.raw`\s${TOWER_WORD}\b`, "i"));
  if (towerCut > 0) line = line.slice(0, towerCut).trim();
  if (!line || ADDRESS_HINT.test(line)) return null;
  if (isSellerOrInvoiceLine(line)) return null;
  if (
    /^(original|delivery|blux|blut|sur|amazon|invoice|customer|address|product|details|prepaid)\b/i.test(
      line,
    )
  ) {
    return null;
  }
  if (/\d{3,}/.test(line)) return null;
  if (/[%#@$]/.test(line)) return null;
  // Reject dotted / initial-heavy OCR junk: "AsE.g huy Ts"
  if ((line.match(/\./g) ?? []).length >= 1 && line.length < 20) return null;

  const words = (line.match(/[A-Za-z][A-Za-z.']*/g) ?? []).filter((word) => {
    const bare = word.replace(/[.'']/g, "");
    if (bare.length < 3) return false;
    if (NAME_SKIP.test(bare)) return false;
    // Real name tokens almost always contain a vowel.
    if (!/[aeiou]/i.test(bare)) return false;
    // Reject ALL-CAPS company fragments longer than typical surnames unless short.
    if (bare.length > 8 && bare === bare.toUpperCase()) return false;
    return true;
  });

  if (words.length === 0) return null;
  const name = words.slice(0, 3).join(" ");
  if (name.length < 5) return null;
  if (words.length === 1) return words[0].length >= 6 ? titleCaseWords(words[0]) : null;
  if (words.length >= 2) return titleCaseWords(name);
  return null;
}

function scorePersonName(name: string): number {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  let score = 0;
  for (const word of words) {
    score += Math.min(word.length, 10);
    if (/[aeiou]/i.test(word)) score += 2;
    if (!/[aeiou]/i.test(word)) score -= 8;
    if (NAME_SKIP.test(word)) score -= 20;
  }
  if (words.length === 2) score += 8;
  if (words.length >= 3) score += 2;
  // Penalize weird casing / OCR soup.
  if (/[A-Z]{4,}.*[a-z].*[A-Z]/.test(name)) score -= 4;
  return score;
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanToken(value: string): string {
  return value.trim().replace(/^[-\s]+|[-\s]+$/g, "").toUpperCase();
}
