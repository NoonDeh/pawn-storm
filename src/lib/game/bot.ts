import type { Item } from "./engine";

export type BotPersonality = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export interface BotMemory {
  recentWins: number;
  recentLosses: number;
  /** Fraction of past auctions where viewers voted RAISE, 0..1. */
  raiseRate: number;
}

/** Highest bid the bot will make, as a multiple of the item's real value. */
const CEILING: Record<BotPersonality, number> = {
  CONSERVATIVE: 0.9,
  BALANCED: 1.0,
  AGGRESSIVE: 1.15,
};

/**
 * Rule-based bot, no ML. It stops raising once the bid passes its ceiling.
 * Memory nudges the ceiling: losing streaks make it more careful, winning
 * streaks make it more aggressive. The rules are deterministic for a given input.
 */
export function botCeiling(
  item: Item,
  personality: BotPersonality,
  memory: BotMemory,
): number {
  let multiplier = CEILING[personality];
  if (memory.recentLosses >= 3) multiplier -= 0.05;
  if (memory.recentWins >= 3) multiplier += 0.05;
  // When viewers almost always raise, the bot can hold a slightly higher line.
  if (memory.raiseRate > 0.8) multiplier += 0.02;
  return Math.round(item.realValue * multiplier * 100) / 100;
}

/** Returns the next bid the bot will place, or null to fold. */
export function botNextBid(
  item: Item,
  currentBid: number,
  increment: number,
  personality: BotPersonality,
  memory: BotMemory,
): number | null {
  const ceiling = botCeiling(item, personality, memory);
  const next = Math.round((currentBid + increment) * 100) / 100;
  return next <= ceiling ? next : null;
}
