import { roundCents, type Item } from "./engine";
import { botNextBid, type BotMemory, type BotPersonality } from "./bot";

export type Choice = "RAISE" | "SURRENDER";

export type RoundResult =
  | { outcome: "STREAMER_WON"; winner: "STREAMER"; finalBid: number }
  | { outcome: "BOT_WON"; winner: "BOT"; finalBid: number }
  | { outcome: "CONTINUE"; currentBid: number };

/**
 * Resolves one voting round. RAISE needs a strict majority of votes. Otherwise
 * (including no votes and ties) the streamer surrenders and the bot wins at the
 * current bid. A raise above the streamer's balance is treated as a surrender.
 * If the bot counters, the auction continues with the bot's bid as the current bid.
 */
export function resolveRound(
  item: Item,
  currentBid: number,
  increment: number,
  choices: Choice[],
  balance: number,
  personality: BotPersonality,
  memory: BotMemory,
): RoundResult {
  const raises = choices.filter((c) => c === "RAISE").length;
  const surrenders = choices.length - raises;

  if (raises <= surrenders) {
    return { outcome: "BOT_WON", winner: "BOT", finalBid: currentBid };
  }

  const streamerBid = roundCents(currentBid + increment);
  if (streamerBid > balance) {
    return { outcome: "BOT_WON", winner: "BOT", finalBid: currentBid };
  }

  const botBid = botNextBid(item, streamerBid, increment, personality, memory);
  if (botBid === null) {
    return { outcome: "STREAMER_WON", winner: "STREAMER", finalBid: streamerBid };
  }
  return { outcome: "CONTINUE", currentBid: botBid };
}
