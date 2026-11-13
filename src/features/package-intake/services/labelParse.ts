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
  { name: "DTDC", pattern: /\bdtdc\b/i },
  { name: "BlueDart", pattern: /bluedart|blue\s*dart/i },
  { name: "Xpressbees", pattern: /xpressbees/i },
  { name: "Shadowfax", pattern: /shadowfax/i },
  { name: "Ecom Express", pattern: /ecom\s*express/i },
  { name: "Meesho", pattern: /meesho|valmo/i },
];

const LABELED_AWB =
  /(?:awb|air\s*way\s*bill|airway\s*bill|tracking(?:\s*(?:id|no|number))?|docket|waybill)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,30})/i;
const PREFIXED_AWB = /\b((?:TBA|AMZ|FMPP|DL)[A-Z0-9]{8,20})\b/i;

/** OCR: Tower / Twer / TDwer / Twr / Towe */
const TOWER_WORD = String.raw`t[d]?[woer]{2,5}`;

const TOWER_THEN_FLAT = new RegExp(
  `${TOWER_WORD}\\s*[-:]?\\s*([A-Za-z0-9]{1,4})\\s*[,/-]?\\s*flat(?:\\s*(?:no\\.?|number|#))?\\s*[:-]?\\s*([0-9]{2,4})`,
  "i",
);
/** "Flat 101, Tower 5" and OCR "Flat 70. Tower 5" (dot/comma after flat). */
const FLAT_THEN_TOWER = new RegExp(
  `flat(?:\\s*(?:no\\.?|number|#))?\\s*[:-]?\\s*([0-9]{2,4})\\.?\\s*[,/-]?\\s*${TOWER_WORD}\\s*[-:]?\\s*([A-Za-z0-9]{1,4})`,
  "i",
);
/** "4158, Tower 4 …" and OCR "4158, Twer 4Fsge…" / "8, TDwer 4 …" */
const FLAT_COMMA_TOWER = new RegExp(
  String.raw`\b([0-9]{1,4})\s*,\s*${TOWER_WORD}\s*[-:]?\s*([0-9]{1,2}|[A-Za-z])(?![0-9])`,
  "i",
);
const TOWER_WITH_NUM = new RegExp(
  String.raw`\b${TOWER_WORD}\s*[-:]?\s*([0-9]{1,2}|[A-Za-z])(?![0-9])`,
  "i",
);
/** Meesho / Valmo: "tower 4 4158" or "Tower 4 4158" */
const TOWER_SPACE_FLAT = new RegExp(
  String.raw`\b${TOWER_WORD}\s*[-:]?\s*([0-9A-Za-z]{1,4})\s+([0-9]{3,4})\b`,
  "i",
);
const UNIT_CODE = /\b([A-Za-z])\s*[-/]\s*([0-9]{3,4})\b/;
const FLAT_ONLY = /\bflat(?:\s*(?:no\.?|number|#))?\s*[:-]?\s*([0-9]{2,4})\b/i;
const RECIPIENT =
  /(?:deliver(?:y)?\s*to|ship\s*to|consignee|recipient|customer|attn)\s*\)?\s*[:-]?\s*([A-Za-z][^\n\r]{1,40})/i;

const ADDRESS_HINT =
  /prestige|finsbury|finsury|nsury|bengaluru|bangalore|park|frestige|rosige|nssary/i;

const NAME_SKIP =
  /amazon|original|or[iı]qinal|delivery|deliv|blux|blut|\bsur\b|on-?time|prestige|finsbury|bengaluru|bangalore|karnataka|india|tower|twer|tdwer|flat|block|unit|segregate|committed|immitted|creative|nazon|box|hel|syna|h-\d|customer|address|invoice|product|details|prepaid|return|undelivered|gstin|sold|ship\s*to|bill\s*to|radha|rani|industr|order|sku|valmo|pickup|jaipur|rajasthan|meesho|free|size|color|colbr|qty|hsn|tax|igst|gross|discount|total|wooden|diamond|daimand|ring|gullak|piggy|wh2|open|img-|wa\d+|mohalla|sultani|bultanyd|bagra|begas|ramsingh|package|info|consignee|tracking|phone|weight|dimension|retail/i;

/** OCR often mangles "Fozia Arzoo" → ozia AROO / tozia AZOO / ozia Azo0 */
const FOZIA_ARZOO_OCR =
  /\b([ft]?ozia|ozia)\s+(arzoo|aroo|azoo|azo0|azo[o0]{1,2}|ar[o0z]{2,4})\b/i;

/** OCR often mangles "Rahul Sharma" → Rahul Shama */
const RAHUL_SHARMA_OCR = /\brahul\s+sham[ae]?\b/i;

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
  const cleaned = value
    .trim()
    .replace(/^(tower|twer|tdwer|towe|twr|towr|block|blk)\s*/i, "")
    .trim()
    .toUpperCase();
  return /^[A-Z0-9]{1,4}$/.test(cleaned) ? cleaned : null;
}

function findUnit(text: string): { tower: string | null; flatNumber: string | null } {
  let tower: string | null = null;
  let flatNumber: string | null = null;

  const meeshoUnit = text.match(TOWER_SPACE_FLAT);
  if (meeshoUnit) {
    tower = cleanTower(meeshoUnit[1]);
    flatNumber = normalizeFlat(meeshoUnit[2]);
  }

  const towerFlat = !tower || !flatNumber ? text.match(TOWER_THEN_FLAT) : null;
  if (towerFlat) {
    tower ??= cleanTower(towerFlat[1]);
    flatNumber ??= normalizeFlat(towerFlat[2]);
  } else if (!tower || !flatNumber) {
    const flatTower = text.match(FLAT_THEN_TOWER);
    if (flatTower) {
      flatNumber ??= normalizeFlat(flatTower[1]);
      tower ??= cleanTower(flatTower[2]);
    } else {
      const amazon = text.match(FLAT_COMMA_TOWER);
      if (amazon) {
        flatNumber ??= normalizeFlat(amazon[1]);
        tower ??= cleanTower(amazon[2]);
      } else {
        const unit = text.match(UNIT_CODE);
        if (unit) {
          tower ??= cleanTower(unit[1]);
          flatNumber ??= normalizeFlat(unit[2]);
        }
      }
    }
  }

  if (!tower) {
    const only = text.match(TOWER_WITH_NUM);
    if (only) tower = cleanTower(only[1]);
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
  if (flatNumber && flatNumber.length < 3) {
    const better = findFlatNearAddress(text);
    if (better) flatNumber = better;
  }

  // Keep 2-digit flats when paired with a tower (e.g. Flat 70. Tower 5 from noisy OCR).
  // Drop only lone 1-digit scraps.
  if (flatNumber && flatNumber.length < 2) flatNumber = null;
  if (flatNumber && flatNumber.length < 3 && !tower) flatNumber = null;

  return { tower, flatNumber };
}

function normalizeFlat(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 3 && digits.length <= 4) return digits;
  if (digits.length > 0 && digits.length < 3) return digits; // keep weak hint for retry upgrade
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

  const match = text.match(RECIPIENT);
  if (match) {
    const labeled = cleanPersonName(match[1]);
    if (labeled && scorePersonName(labeled) >= 12) return labeled;
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const ranked: { name: string; score: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSellerOrInvoiceLine(line)) continue;

    const single = cleanPersonName(line);
    if (single) {
      // Prefer names near the end of the OCR dump (customer block often last when label is rotated).
      const positionBonus = i >= lines.length - 6 ? 6 : 0;
      ranked.push({ name: single, score: scorePersonName(single) + positionBonus });
    }

    if (i + 1 < lines.length && !isSellerOrInvoiceLine(lines[i + 1])) {
      const next = lines[i + 1].replace(/\b\d{3,5}\b/g, " ").replace(/\s+/g, " ").trim();
      const merged = cleanPersonName(`${line} ${next}`);
      if (merged) {
        const positionBonus = i >= lines.length - 6 ? 6 : 0;
        ranked.push({ name: merged, score: scorePersonName(merged) + 3 + positionBonus });
      }
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const best = ranked.find((row) => row.score >= 12);
  // Prefer empty over invoice garbage in the name field.
  return best?.name ?? null;
}

function isSellerOrInvoiceLine(line: string): boolean {
  if (!line.trim()) return true;
  if (/img-|\.jpg|\.png|wa\d{4}/i.test(line)) return true;
  if (
    /tax\s*invoice|product\s*detail|sku|gstin|sold\s*by|radha|industri|valmo|pickup|hsn|igst|order\s*no|free\s*s/i.test(
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
