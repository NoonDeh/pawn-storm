export type Condition = "PRISTINE" | "EXCELLENT" | "GOOD" | "WORN" | "DAMAGED" | "BROKEN";
export type Authenticity = "AUTHENTIC" | "QUESTIONABLE" | "FAKE";
export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY" | "MYTHIC";

export interface Item {
  name: string;
  baseValue: number;
  condition: Condition;
  authenticity: Authenticity;
  rarity: Rarity;
  realValue: number;
  estimateMin: number;
  estimateMax: number;
  startingBid: number;
}

const CONDITION_TABLE: Array<[Condition, number, number]> = [
  ["PRISTINE", 5, 1.0],
  ["EXCELLENT", 15, 0.92],
  ["GOOD", 30, 0.82],
  ["WORN", 30, 0.62],
  ["DAMAGED", 15, 0.42],
  ["BROKEN", 5, 0.18],
];

const AUTH_TABLE: Array<[Authenticity, number, number]> = [
  ["AUTHENTIC", 55, 1.0],
  ["QUESTIONABLE", 30, 0.72],
  ["FAKE", 15, 0.25],
];

const RARITY_TABLE: Array<[Rarity, number, number]> = [
  ["COMMON", 45, 1.0],
  ["UNCOMMON", 30, 1.75],
  ["RARE", 15, 3.0],
  ["LEGENDARY", 8, 6.0],
  ["MYTHIC", 2, 12.0],
];

/** Picks a key from a table whose weights are percentages (they sum to 100). */
function weightedPick<T>(table: Array<[T, number, number]>, roll: number): [T, number] {
  let acc = 0;
  for (const [key, weight, modifier] of table) {
    acc += weight;
    if (roll < acc) return [key, modifier];
  }
  const last = table[table.length - 1];
  return [last[0], last[2]];
}

/**
 * Builds an item from a random source. `rng` must return values in [0, 1).
 * Pass a seeded rng in tests; use crypto-backed randomness in production.
 */
export function generateItem(
  baseName: string,
  baseValue: number,
  rng: () => number,
): Item {
  const [condition, conditionMod] = weightedPick(CONDITION_TABLE, rng() * 100);
  const [authenticity, authMod] = weightedPick(AUTH_TABLE, rng() * 100);
  const [rarity, rarityMod] = weightedPick(RARITY_TABLE, rng() * 100);

  const realValue = roundCents(baseValue * conditionMod * authMod * rarityMod);
  // Estimate is a band around the real value so the bidder sees a range, not the answer.
  const estimateMin = roundCents(realValue * 0.8);
  const estimateMax = roundCents(realValue * 1.2);
  // Starting bid sits slightly under the estimate minimum.
  const startingBid = roundCents(estimateMin * 0.9);

  return {
    name: baseName,
    baseValue,
    condition,
    authenticity,
    rarity,
    realValue,
    estimateMin,
    estimateMax,
    startingBid,
  };
}

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
