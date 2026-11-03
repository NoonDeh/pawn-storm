import { describe, expect, it } from "vitest";
import { generateItem, type Item } from "./engine";
import { resolveRound } from "./round";

const item: Item = generateItem("Test", 1000, () => 0.99);
const memory = { recentWins: 0, recentLosses: 0, raiseRate: 0.5 };

describe("resolveRound", () => {
  it("bot wins when there are no votes", () => {
    const r = resolveRound(item, 100, 10, [], 1000, "BALANCED", memory);
    expect(r).toEqual({ outcome: "BOT_WON", winner: "BOT", finalBid: 100 });
  });

  it("bot wins on a tie", () => {
    const r = resolveRound(item, 100, 10, ["RAISE", "SURRENDER"], 1000, "BALANCED", memory);
    expect(r.outcome).toBe("BOT_WON");
  });

  it("bot wins when raise exceeds balance", () => {
    const r = resolveRound(item, 100, 10, ["RAISE", "RAISE"], 105, "BALANCED", memory);
    expect(r).toEqual({ outcome: "BOT_WON", winner: "BOT", finalBid: 100 });
  });

  it("streamer wins when bot folds at the raised bid", () => {
    const r = resolveRound(item, 535, 10, ["RAISE"], 1000, "BALANCED", memory);
    expect(r).toEqual({ outcome: "STREAMER_WON", winner: "STREAMER", finalBid: 545 });
  });

  it("continues with the bot's counter bid when the bot still has room", () => {
    const r = resolveRound(item, 100, 10, ["RAISE", "RAISE", "SURRENDER"], 1000, "AGGRESSIVE", memory);
    expect(r.outcome).toBe("CONTINUE");
  });
});
