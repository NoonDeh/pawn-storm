import { roundCents, type Item } from "./engine";

export type Winner = "STREAMER" | "BOT";

export interface Settlement {
  winner: Winner;
  finalBid: number;
  realValue: number;
  profit: number;
  newBalance: number;
}

/**
 * Settles one auction. The winner pays the final bid and the item is
 * liquidated at its real value. Profit or loss is shown only after this runs.
 * The streamer side is credited or debited; the bot side only sets the outcome.
 */
export function settle(
  item: Item,
  winner: Winner,
  finalBid: number,
  balance: number,
): Settlement {
  const realValue = item.realValue;
  const profit = roundCents(realValue - finalBid);
  const newBalance = winner === "STREAMER" ? roundCents(balance + profit) : balance;
  return { winner, finalBid, realValue, profit, newBalance };
}
