/**
 * Server-authoritative SUBBY Points packages.
 * Clients select packageId only — never points or NGN amount.
 *
 * amountMinor = NGN kobo charged via Paystack (integer).
 * points = SUBBY Points credited (integer, 1:1 with ledger minor units).
 */

export type PointPackage = {
  id: string;
  label: string;
  points: number;
  amountMinor: number;
  currency: "NGN";
};

export const POINT_PACKAGES: readonly PointPackage[] = [
  {
    id: "pts_1k",
    label: "1,000 Points",
    points: 1_000,
    amountMinor: 1_000,
    currency: "NGN",
  },
  {
    id: "pts_5k",
    label: "5,000 Points",
    points: 5_000,
    amountMinor: 5_000,
    currency: "NGN",
  },
  {
    id: "pts_15k",
    label: "15,000 Points",
    points: 15_000,
    amountMinor: 15_000,
    currency: "NGN",
  },
  {
    id: "pts_50k",
    label: "50,000 Points",
    points: 50_000,
    amountMinor: 50_000,
    currency: "NGN",
  },
] as const;

export function getPointPackage(packageId: string): PointPackage {
  const pkg = POINT_PACKAGES.find(p => p.id === packageId);
  if (!pkg) throw new Error("Unknown points package");
  return pkg;
}

export function listPointPackages(): PointPackage[] {
  return POINT_PACKAGES.map(p => ({ ...p }));
}
