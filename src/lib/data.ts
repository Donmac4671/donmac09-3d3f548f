export interface DataBundle {
  size: string;
  sizeGB: number;
  price: number;        // agent price
  generalPrice: number; // general user price
}

export interface Network {
  id: string;
  name: string;
  color: string;
  gradient: string;
  bundles: DataBundle[];
}

export const networks: Network[] = [
  {
    id: "mtn",
    name: "MTN",
    color: "bg-yellow-400",
    gradient: "gradient-mtn",
    bundles: [
      { size: "1GB", sizeGB: 1, price: 4.00, generalPrice: 4.00 },
      { size: "2GB", sizeGB: 2, price: 8.00, generalPrice: 8.00 },
      { size: "3GB", sizeGB: 3, price: 12.00, generalPrice: 12.00 },
      { size: "4GB", sizeGB: 4, price: 16.00, generalPrice: 16.00 },
      { size: "5GB", sizeGB: 5, price: 20.00, generalPrice: 20.00 },
      { size: "6GB", sizeGB: 6, price: 24.00, generalPrice: 24.00 },
      { size: "7GB", sizeGB: 7, price: 28.00, generalPrice: 28.00 },
      { size: "8GB", sizeGB: 8, price: 32.00, generalPrice: 32.00 },
      { size: "10GB", sizeGB: 10, price: 40.00, generalPrice: 40.00 },
      { size: "15GB", sizeGB: 15, price: 60.00, generalPrice: 60.00 },
      { size: "20GB", sizeGB: 20, price: 80.00, generalPrice: 80.00 },
      { size: "25GB", sizeGB: 25, price: 100.00, generalPrice: 100.00 },
      { size: "30GB", sizeGB: 30, price: 120.00, generalPrice: 120.00 },
      { size: "40GB", sizeGB: 40, price: 160.00, generalPrice: 160.00 },
      { size: "50GB", sizeGB: 50, price: 200.00, generalPrice: 200.00 },
    ],
  },
  {
    id: "telecel",
    name: "TELECEL",
    color: "bg-red-500",
    gradient: "gradient-telecel",
    bundles: [
      { size: "2GB", sizeGB: 2, price: 10.20, generalPrice: 10.20 },
      { size: "3GB", sizeGB: 3, price: 15.40, generalPrice: 15.40 },
      { size: "5GB", sizeGB: 5, price: 22.00, generalPrice: 22.00 },
      { size: "10GB", sizeGB: 10, price: 42.00, generalPrice: 42.00 },
      { size: "15GB", sizeGB: 15, price: 60.00, generalPrice: 60.00 },
      { size: "20GB", sizeGB: 20, price: 80.00, generalPrice: 80.00 },
      { size: "25GB", sizeGB: 25, price: 98.00, generalPrice: 98.00 },
      { size: "30GB", sizeGB: 30, price: 118.00, generalPrice: 118.00 },
      { size: "40GB", sizeGB: 40, price: 158.00, generalPrice: 158.00 },
      { size: "50GB", sizeGB: 50, price: 189.00, generalPrice: 189.00 },
    ],
  },
  {
    id: "at-bigtime",
    name: "AT BIG TIME",
    color: "bg-sky-600",
    gradient: "gradient-at-bigtime",
    bundles: [
      { size: "15GB", sizeGB: 15, price: 57.00, generalPrice: 57.00 },
      { size: "20GB", sizeGB: 20, price: 63.00, generalPrice: 63.00 },
      { size: "30GB", sizeGB: 30, price: 74.00, generalPrice: 74.00 },
      { size: "40GB", sizeGB: 40, price: 85.00, generalPrice: 85.00 },
      { size: "50GB", sizeGB: 50, price: 94.00, generalPrice: 94.00 },
      { size: "60GB", sizeGB: 60, price: 105.00, generalPrice: 105.00 },
      { size: "70GB", sizeGB: 70, price: 137.00, generalPrice: 137.00 },
      { size: "80GB", sizeGB: 80, price: 151.00, generalPrice: 151.00 },
      { size: "90GB", sizeGB: 90, price: 162.00, generalPrice: 162.00 },
      { size: "100GB", sizeGB: 100, price: 176.00, generalPrice: 176.00 },
      { size: "130GB", sizeGB: 130, price: 220.00, generalPrice: 220.00 },
      { size: "140GB", sizeGB: 140, price: 245.00, generalPrice: 245.00 },
      { size: "150GB", sizeGB: 150, price: 273.00, generalPrice: 273.00 },
      { size: "200GB", sizeGB: 200, price: 367.00, generalPrice: 367.00 },
    ],
  },
  {
    id: "at-premium",
    name: "AT PREMIUM",
    color: "bg-sky-700",
    gradient: "gradient-at-premium",
    bundles: [
      { size: "1GB", sizeGB: 1, price: 4.00, generalPrice: 4.00 },
      { size: "2GB", sizeGB: 2, price: 8.00, generalPrice: 8.00 },
      { size: "3GB", sizeGB: 3, price: 12.10, generalPrice: 12.10 },
      { size: "4GB", sizeGB: 4, price: 16.10, generalPrice: 16.10 },
      { size: "5GB", sizeGB: 5, price: 20.10, generalPrice: 20.10 },
      { size: "6GB", sizeGB: 6, price: 24.10, generalPrice: 24.10 },
      { size: "7GB", sizeGB: 7, price: 28.10, generalPrice: 28.10 },
      { size: "8GB", sizeGB: 8, price: 32.10, generalPrice: 32.10 },
      { size: "10GB", sizeGB: 10, price: 40.00, generalPrice: 40.00 },
      { size: "12GB", sizeGB: 12, price: 48.10, generalPrice: 48.10 },
      { size: "15GB", sizeGB: 15, price: 60.20, generalPrice: 60.20 },
      { size: "20GB", sizeGB: 20, price: 80.30, generalPrice: 80.30 },
      { size: "25GB", sizeGB: 25, price: 100.30, generalPrice: 100.30 },
      { size: "30GB", sizeGB: 30, price: 120.40, generalPrice: 120.40 },
    ],
  },
];

export interface CartItem {
  id: string;
  network: string;
  networkId: string;
  bundle: DataBundle;
  phoneNumber: string;
  /** The actual price charged (tier-dependent) */
  effectivePrice: number;
  /** The base cost of the item */
  wholesalePrice: number;
  /** The store ID if this is a referred purchase */
  storeId?: string | null;
}

export interface Order {
  id: string;
  date: string;
  network: string;
  phoneNumber: string;
  bundle: string;
  amount: number;
  status: "completed" | "pending" | "processing" | "failed";
}

export interface Transaction {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  status: "completed" | "pending" | "failed";
}

export interface TopUp {
  id: string;
  date: string;
  method: string;
  amount: number;
  status: "completed" | "pending" | "failed";
}

export interface MashupPackage {
  price: number;     // Cedis the user pays for the package itself (before fees)
  data: string;      // e.g. "15.27 MB"
  minutes: string;   // e.g. "15.64 Minutes"
  label: string;     // human readable summary
}

export const MASHUP_PACKAGES: MashupPackage[] = [
  { price: 1, data: "15.27 MB", minutes: "15.64 Minutes", label: "₵1 — 15.27 MB & 15.64 Minutes" },
  { price: 2, data: "30.53 MB", minutes: "31.27 Minutes", label: "₵2 — 30.53 MB & 31.27 Minutes" },
  { price: 3, data: "48.8 MB", minutes: "46.92 Minutes", label: "₵3 — 48.8 MB & 46.92 Minutes" },
  { price: 4, data: "61.07 MB", minutes: "62.55 Minutes", label: "₵4 — 61.07 MB & 62.55 Minutes" },
  { price: 5, data: "86.12 MB", minutes: "83.24 Minutes", label: "₵5 — 86.12 MB & 83.24 Minutes" },
  { price: 6, data: "103.35 MB", minutes: "99.88 Minutes", label: "₵6 — 103.35 MB & 99.88 Minutes" },
  { price: 7, data: "120.27 MB", minutes: "116.53 Minutes", label: "₵7 — 120.27 MB & 116.53 Minutes" },
  { price: 8, data: "137 MB", minutes: "133.18 Minutes", label: "₵8 — 137 MB & 133.18 Minutes" },
  { price: 9, data: "155.02 MB", minutes: "149.83 Minutes", label: "₵9 — 155.02 MB & 149.83 Minutes" },
  { price: 10, data: "180.72 MB", minutes: "173.39 Minutes", label: "₵10 — 180.72 MB & 173.39 Minutes" },
  { price: 15, data: "271.07 MB", minutes: "260.08 Minutes", label: "₵15 — 271.07 MB & 260.08 Minutes" },
  { price: 20, data: "361.43 MB", minutes: "346.78 Minutes", label: "₵20 — 361.43 MB & 346.78 Minutes" },
  { price: 25, data: "451.79 MB", minutes: "433.48 Minutes", label: "₵25 — 451.79 MB & 433.48 Minutes" },
  { price: 29.99, data: "541.97 MB", minutes: "520 Minutes", label: "₵29.99 — 541.97 MB & 520 Minutes" },
];

export const MASHUP_FEE_PERCENT = 0; // 0% fee added on top of the package price
export const AIRTIME_MIN = 0;
export const AIRTIME_MAX = 50;

export function calculateMashupFee(amount: number): number {
  return Math.round(amount * MASHUP_FEE_PERCENT * 100) / 100;
}

export interface TelecelVSVariant {
  kind: "vs" | "vds";       // vs = Voice + SMS, vds = Voice + Data + SMS
  minutes: string;
  data?: string;            // only for vds
  sms: string;
  validity?: string;
  allNetworks?: boolean;
}

export interface TelecelVSPackage {
  price: number;
  isSpecial?: boolean;
  variants: TelecelVSVariant[];
  label: string;
}

export const TELECEL_VS_PACKAGES: TelecelVSPackage[] = [
  // Special offer FIRST
  {
    price: 5,
    isSpecial: true,
    label: "Special ₵5 — 200 Minutes (All Networks, 7 days)",
    variants: [
      { kind: "vs", minutes: "200 Minutes", sms: "All Networks", validity: "7 days", allNetworks: true },
    ],
  },
  {
    price: 1, label: "₵1",
    variants: [
      { kind: "vs", minutes: "21 Minutes", sms: "5 SMS" },
      { kind: "vds", minutes: "16 Minutes", data: "17.83 MB", sms: "5 SMS" },
    ],
  },
  {
    price: 2, label: "₵2",
    variants: [
      { kind: "vs", minutes: "43 Minutes", sms: "5 SMS" },
      { kind: "vds", minutes: "32 Minutes", data: "35.66 MB", sms: "5 SMS" },
    ],
  },
  {
    price: 3, label: "₵3",
    variants: [
      { kind: "vs", minutes: "64 Minutes", sms: "5 SMS" },
      { kind: "vds", minutes: "48 Minutes", data: "53.49 MB", sms: "5 SMS" },
    ],
  },
  {
    price: 4, label: "₵4",
    variants: [
      { kind: "vs", minutes: "84 Minutes", sms: "5 SMS" },
      { kind: "vds", minutes: "64 Minutes", data: "71.32 MB", sms: "5 SMS" },
    ],
  },
  {
    price: 5, label: "₵5",
    variants: [
      { kind: "vs", minutes: "114 Minutes", sms: "10 SMS" },
      { kind: "vds", minutes: "85 Minutes", data: "94.72 MB", sms: "10 SMS" },
    ],
  },
  {
    price: 6, label: "₵6",
    variants: [
      { kind: "vs", minutes: "137 Minutes", sms: "10 SMS" },
      { kind: "vds", minutes: "102 Minutes", data: "113.66 MB", sms: "10 SMS" },
    ],
  },
  {
    price: 7, label: "₵7",
    variants: [
      { kind: "vs", minutes: "160 Minutes", sms: "10 SMS" },
      { kind: "vds", minutes: "119 Minutes", data: "132.6 MB", sms: "10 SMS" },
    ],
  },
  {
    price: 8, label: "₵8",
    variants: [
      { kind: "vs", minutes: "183 Minutes", sms: "10 SMS" },
      { kind: "vds", minutes: "136 Minutes", data: "151.54 MB", sms: "10 SMS" },
    ],
  },
  {
    price: 9, label: "₵9",
    variants: [
      { kind: "vs", minutes: "206 Minutes", sms: "10 SMS" },
      { kind: "vds", minutes: "153 Minutes", data: "170.49 MB", sms: "10 SMS" },
    ],
  },
  {
    price: 10, label: "₵10",
    variants: [
      { kind: "vs", minutes: "236 Minutes", sms: "50 SMS" },
      { kind: "vds", minutes: "175 Minutes", data: "195 MB", sms: "50 SMS" },
    ],
  },
  {
    price: 15, label: "₵15",
    variants: [
      { kind: "vs", minutes: "354 Minutes", sms: "50 SMS" },
      { kind: "vds", minutes: "262 Minutes", data: "292.5 MB", sms: "50 SMS" },
    ],
  },
  {
    price: 20, label: "₵20",
    variants: [
      { kind: "vs", minutes: "486 Minutes", sms: "50 SMS" },
      { kind: "vds", minutes: "359 Minutes", data: "401.15 MB", sms: "50 SMS" },
    ],
  },
  {
    price: 25, label: "₵25",
    variants: [
      { kind: "vs", minutes: "607 Minutes", sms: "50 SMS" },
      { kind: "vds", minutes: "449 Minutes", data: "501.43 MB", sms: "50 SMS" },
    ],
  },
  {
    price: 29.99, label: "₵29.99",
    variants: [
      { kind: "vs", minutes: "729 Minutes", sms: "50 SMS" },
      { kind: "vds", minutes: "539 Minutes", data: "601.52 MB", sms: "50 SMS" },
    ],
  },
];

export const TELECEL_VS_FEE_PERCENT = 0; // 0% fee at checkout

export function calculateTelecelVSFee(amount: number): number {
  return Math.round(amount * TELECEL_VS_FEE_PERCENT * 100) / 100;
}

export const MIN_TOPUP = 10;

export function getMinTopUp(_tier?: string): number {
  return MIN_TOPUP;
}

export function formatCurrency(amount: number): string {
  return `₵${amount.toFixed(2)}`;
}

/** Reseller pricing — single price per bundle */
export function getBundlePrice(bundle: DataBundle, _tier?: string): number {
  return bundle.price;
}

