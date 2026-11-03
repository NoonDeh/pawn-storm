import { describe, expect, it } from "vitest";
import { generateItem } from "./engine";
import { settle } from "./settlement";
import { botNextBid } from "./bot";

const fixed = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("generateItem", () => {
  it("applies condition, authenticity and rarity multipliers", () => {
    // roll 0 picks the first row of each table: PRISTINE, AUTHENTIC, COMMON
    const item = generateItem("Pocket Watch", 150, fixed([0]));
    expect(item.condition).toBe("PRISTINE");
    expect(item.authenticity).toBe("AUTHENTIC");
    expect(item.rarity).toBe("COMMON");
    expect(item.realValue).toBe(150);
  });

  it("starts below the estimate minimum", () => {
    const item = generateItem("Pocket Watch", 150, fixed([0]));
    expect(item.startingBid).toBeLessThan(item.estimateMin);
  });
});

describe("settle", () => {
  it("credits profit to the streamer when the streamer wins", () => {
    const item = generateItem("Pocket Watch", 150, fixed([0]));
    const result = settle(item, "STREAMER", 120, 1000);
    expect(result.profit).toBe(30);
    expect(result.newBalance).toBe(1030);
  });

  it("leaves balance unchanged when the bot wins", () => {
    const item = generateItem("Pocket Watch", 150, fixed([0]));
    const result = settle(item, "BOT", 200, 1000);
    expect(result.newBalance).toBe(1000);
  });
});

describe("botNextBid", () => {
  it("folds once the next bid passes the ceiling", () => {
    const item = generateItem("Pocket Watch", 100, fixed([0]));
    const memory = { recentWins: 0, recentLosses: 0, raiseRate: 0.5 };
    expect(botNextBid(item, 140, 10, "BALANCED", memory)).toBeNull();
    expect(botNextBid(item, 80, 10, "BALANCED", memory)).toBe(90);
  });
});
