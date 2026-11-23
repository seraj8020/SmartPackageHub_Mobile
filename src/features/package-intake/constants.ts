export const INTAKE_COURIERS = [
  "Amazon",
  "BlueDart",
  "Delhivery",
  "DTDC",
  "Flipkart",
  "Meesho",
  "Shadowfax",
  "Xpressbees",
  "Other",
] as const;

export const STAFF_NAME_STORAGE_KEY = "SPH_staff_name";

/** Used when OCR / staff leave package details blank on confirm. */
export const DEFAULT_INTAKE_WEIGHT_KG = 1;
export const DEFAULT_INTAKE_LENGTH_CM = 1;
export const DEFAULT_INTAKE_WIDTH_CM = 1;
export const DEFAULT_INTAKE_HEIGHT_CM = 1;

export const BARCODE_TYPES = [
  "code128",
  "code39",
  "qr",
  "datamatrix",
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "codabar",
  "pdf417",
  "itf14",
] as const;
