export interface ParsedLabel {
  courier: string | null;
  awb: string | null;
  recipientName: string | null;
  tower: string | null;
  flatNumber: string | null;
}

const COURIERS: { name: string; pattern: RegExp }[] = [
  { name: "Amazon", pattern: /amazon|amzl|\bamz\b/i },
  { name: "Flipkart", pattern: /flipkart|ekart/i },
  { name: "Delhivery", pattern: /delhivery/i },
  { name: "DTDC", pattern: /\bdtdc\b/i },
  { name: "BlueDart", pattern: /bluedart|blue\s*dart/i },
  { name: "Xpressbees", pattern: /xpressbees/i },
  { name: "Shadowfax", pattern: /shadowfax/i },
  { name: "Ecom Express", pattern: /ecom\s*express/i },
  { name: "Meesho", pattern: /meesho/i },
];

const LABELED_AWB =
  /(?:awb|air\s*way\s*bill|airway\s*bill|tracking(?:\s*(?:id|no|number))?|docket|waybill)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,30})/i;
const PREFIXED_AWB = /\b((?:TBA|AMZ|FMPP|DL)[A-Z0-9]{8,20})\b/i;
const TOWER_THEN_FLAT =
  /tower\s*[-:]?\s*([A-Za-z0-9]{1,4})\s*[,/-]?\s*flat(?:\s*(?:no\.?|number|#))?\s*[:-]?\s*([0-9]{2,4})/i;
const FLAT_THEN_TOWER =
  /flat(?:\s*(?:no\.?|number|#))?\s*[:-]?\s*([0-9]{2,4})\s*[,/-]?\s*tower\s*[-:]?\s*([A-Za-z0-9]{1,4})/i;
const UNIT_CODE = /\b([A-Za-z])\s*[-/]\s*([0-9]{3,4})\b/;
const TOWER_ONLY = /\b(?:tower|twr|block|blk)\s*[-:]?\s*([A-Za-z0-9]{1,4})\b/i;
const FLAT_ONLY = /\bflat(?:\s*(?:no\.?|number|#))?\s*[:-]?\s*([0-9]{3,4})\b/i;
const RECIPIENT = /(?:deliver(?:y)?\s*to|ship\s*to|recipient|customer|attn)\s*[:-]?\s*([A-Za-z][^\n\r]{1,40})/i;

export function parseLabel(raw: string): ParsedLabel {
  const text = raw.replace(/\r/g, "\n").slice(0, 8000);
  let tower: string | null = null;
  let flatNumber: string | null = null;

  const towerFlat = text.match(TOWER_THEN_FLAT);
  if (towerFlat) {
    tower = cleanTower(towerFlat[1]);
    flatNumber = towerFlat[2];
  } else {
    const flatTower = text.match(FLAT_THEN_TOWER);
    if (flatTower) {
      flatNumber = flatTower[1];
      tower = cleanTower(flatTower[2]);
    } else {
      const unit = text.match(UNIT_CODE);
      if (unit) {
        tower = cleanTower(unit[1]);
        flatNumber = unit[2];
      }
    }
  }

  if (!tower) {
    const only = text.match(TOWER_ONLY);
    if (only) tower = cleanTower(only[1]);
  }
  if (!flatNumber) {
    const only = text.match(FLAT_ONLY);
    if (only) flatNumber = only[1];
  }

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
    .replace(/^(tower|twr|block|blk)\s*/i, "")
    .trim()
    .toUpperCase();
  return /^[A-Z0-9]{1,4}$/.test(cleaned) ? cleaned : null;
}

function findCourier(text: string): string | null {
  return COURIERS.find((courier) => courier.pattern.test(text))?.name ?? null;
}

function findAwb(text: string): string | null {
  const labeled = text.match(LABELED_AWB);
  if (labeled) return cleanToken(labeled[1]);
  const prefixed = text.match(PREFIXED_AWB);
  if (prefixed) return cleanToken(prefixed[1]);

  for (const line of text.split("\n")) {
    if (/pin|pincode|phone|mobile|tel/i.test(line)) continue;
    const token = line.match(/\b([A-Z0-9]{10,22})\b/i);
    if (!token) continue;
    if (/^\d{6}$/.test(token[1]) || /^\d{10}$/.test(token[1])) continue;
    return token[1].toUpperCase();
  }
  return null;
}

function findName(text: string): string | null {
  const match = text.match(RECIPIENT);
  if (!match) return null;
  const line = match[1].split(",")[0].trim();
  if (/^(tower|flat|block|unit)\b/i.test(line)) return null;
  const words = line.match(/[A-Za-z][A-Za-z.'-]*/g);
  if (!words || words.length === 0) return null;
  const name = words.slice(0, 4).join(" ");
  return name.length >= 3 ? name : null;
}

function cleanToken(value: string): string {
  return value.trim().replace(/^[-\s]+|[-\s]+$/g, "").toUpperCase();
}
