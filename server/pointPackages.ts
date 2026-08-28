/**
 * Server-authoritative SUBBY Points packages.
 * Clients select packageId only — never points or NGN amount.
 *
 * Pricing (authoritative):
 *   1 Point = ₦500 = 50_000 kobo
 *   amountMinor (Paystack) = points × KOBO_PER_POINT
 */

import {
  KOBO_PER_POINT,
  NGN_MAJOR_PER_POINT,
  POINTS_PRICING_VERSION,
  pointsToKobo,
} from "./subbyPoints";

export type PointPackage = {
  id: string;
  label: string;
  points: number;
  /** NGN kobo charged via Paystack — always points × 50_000 */
  amountMinor: number;
  currency: "NGN";
  ngnMajor: number;
  pricingVersion: string;
};

const PACKAGE_POINT_AMOUNTS = [1, 2, 5, 10, 20, 50, 100] as const;

function buildPackage(points: number): PointPackage {
  const amountMinor = pointsToKobo(points);
  return {
    id: `pts_${points}`,
    label: points === 1 ? "1 Point" : `${points.toLocaleString("en-US")} Points`,
    points,
    amountMinor,
    currency: "NGN",
    ngnMajor: points * NGN_MAJOR_PER_POINT,
    pricingVersion: POINTS_PRICING_VERSION,
  };
}

export const POINT_PACKAGES: readonly PointPackage[] =
  PACKAGE_POINT_AMOUNTS.map(buildPackage);

export function getPointPackage(packageId: string): PointPackage {
  const pkg = POINT_PACKAGES.find(p => p.id === packageId);
  if (!pkg) throw new Error("Unknown points package");
  // Guard against accidental drift
  if (pkg.amountMinor !== pointsToKobo(pkg.points)) {
    throw new Error("Package price inconsistent with authoritative point value");
  }
  return pkg;
}

export function listPointPackages(): PointPackage[] {
  return POINT_PACKAGES.map(p => ({ ...p }));
}

export { KOBO_PER_POINT, NGN_MAJOR_PER_POINT, POINTS_PRICING_VERSION };
