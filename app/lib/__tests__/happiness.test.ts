import { describe, it, expect } from "vitest";
import { computeHappyScore } from "../happiness";
import type { HappinessSignals } from "../../types";

/** Minimal zeroed signals — set only the fields you care about in each test */
function baseSignals(overrides: Partial<HappinessSignals> = {}): HappinessSignals {
  return {
    parkCount: 0,
    waterCount: 0,
    waterwayCount: 0,
    greenCount: 0,
    litCount: 0,
    calmWaterCount: 0,
    rapidCount: 0,
    launchCount: 0,
    portageCount: 0,
    motorBoatCount: 0,
    partial: false,
    ...overrides,
  };
}

describe("computeHappyScore", () => {
  describe("base score", () => {
    it("returns base 5 when all signals are zero", () => {
      const { score, breakdown } = computeHappyScore(baseSignals(), 1);
      expect(score).toBe(5);
      expect(breakdown.base).toBe(5);
    });

    it("breakdown.base is always 5", () => {
      const { breakdown } = computeHappyScore(baseSignals({ parkCount: 10 }), 2);
      expect(breakdown.base).toBe(5);
    });
  });

  describe("score bounds", () => {
    it("score is never below 0", () => {
      const { score } = computeHappyScore(
        baseSignals({ rapidCount: 1000, motorBoatCount: 1000 }),
        1,
        10000
      );
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("score never exceeds 100", () => {
      const { score } = computeHappyScore(
        baseSignals({
          parkCount: 10000,
          waterCount: 10000,
          waterwayCount: 10000,
          greenCount: 10000,
          litCount: 10000,
          calmWaterCount: 10000,
          launchCount: 10000,
          portageCount: 10000,
        }),
        1
      );
      expect(score).toBeLessThanOrEqual(100);
    });

    it("returns a number (not NaN or Infinity)", () => {
      const { score } = computeHappyScore(baseSignals(), 0.1);
      expect(Number.isFinite(score)).toBe(true);
    });
  });

  describe("parks cap", () => {
    it("parks contribution caps at 30", () => {
      // parkCount so large that raw contribution would far exceed 30
      const { breakdown } = computeHappyScore(baseSignals({ parkCount: 10000 }), 1);
      expect(breakdown.parks).toBe(30);
    });

    it("parks below cap scales linearly", () => {
      // 1 park per km * multiplier 12 = 12, well below cap 30
      const { breakdown } = computeHappyScore(baseSignals({ parkCount: 1 }), 1);
      expect(breakdown.parks).toBe(12);
    });
  });

  describe("waterways cap", () => {
    it("waterways contribution caps at 25", () => {
      const { breakdown } = computeHappyScore(baseSignals({ waterwayCount: 10000 }), 1);
      expect(breakdown.waterways).toBe(25);
    });

    it("waterways below cap scales correctly", () => {
      // 1 waterway / 1 km * 10 = 10
      const { breakdown } = computeHappyScore(baseSignals({ waterwayCount: 1 }), 1);
      expect(breakdown.waterways).toBe(10);
    });
  });

  describe("water cap", () => {
    it("water contribution caps at 20", () => {
      const { breakdown } = computeHappyScore(baseSignals({ waterCount: 10000 }), 1);
      expect(breakdown.water).toBe(20);
    });

    it("water below cap scales correctly", () => {
      // 1 water / 1 km * 8 = 8
      const { breakdown } = computeHappyScore(baseSignals({ waterCount: 1 }), 1);
      expect(breakdown.water).toBe(8);
    });
  });

  describe("green cap", () => {
    it("green contribution caps at 15", () => {
      const { breakdown } = computeHappyScore(baseSignals({ greenCount: 10000 }), 1);
      expect(breakdown.green).toBe(15);
    });

    it("green below cap scales correctly", () => {
      // 1 green / 1 km * 5 = 5
      const { breakdown } = computeHappyScore(baseSignals({ greenCount: 1 }), 1);
      expect(breakdown.green).toBe(5);
    });
  });

  describe("lit cap", () => {
    it("lit contribution caps at 10", () => {
      const { breakdown } = computeHappyScore(baseSignals({ litCount: 10000 }), 1);
      expect(breakdown.lit).toBe(10);
    });

    it("lit below cap scales correctly", () => {
      // 1 lit / 1 km * 4 = 4
      const { breakdown } = computeHappyScore(baseSignals({ litCount: 1 }), 1);
      expect(breakdown.lit).toBe(4);
    });
  });

  describe("calmWater cap", () => {
    it("calmWater contribution caps at 15", () => {
      const { breakdown } = computeHappyScore(baseSignals({ calmWaterCount: 10000 }), 1);
      expect(breakdown.calmWater).toBe(15);
    });

    it("calmWater below cap scales correctly", () => {
      // 1 calmWater / 1 km * 6 = 6
      const { breakdown } = computeHappyScore(baseSignals({ calmWaterCount: 1 }), 1);
      expect(breakdown.calmWater).toBe(6);
    });
  });

  describe("launch cap", () => {
    it("launch contribution caps at 8", () => {
      const { breakdown } = computeHappyScore(baseSignals({ launchCount: 10000 }), 1);
      expect(breakdown.launch).toBe(8);
    });

    it("launch below cap scales correctly", () => {
      // 1 launch / 1 km * 3 = 3
      const { breakdown } = computeHappyScore(baseSignals({ launchCount: 1 }), 1);
      expect(breakdown.launch).toBe(3);
    });
  });

  describe("portage cap", () => {
    it("portage contribution caps at 5", () => {
      const { breakdown } = computeHappyScore(baseSignals({ portageCount: 10000 }), 1);
      expect(breakdown.portage).toBe(5);
    });

    it("portage below cap scales correctly", () => {
      // 1 portage / 1 km * 2 = 2
      const { breakdown } = computeHappyScore(baseSignals({ portageCount: 1 }), 1);
      expect(breakdown.portage).toBe(2);
    });
  });

  describe("penalties", () => {
    it("rapids penalty caps at 15", () => {
      const { breakdown } = computeHappyScore(baseSignals({ rapidCount: 10000 }), 1);
      expect(breakdown.rapids).toBe(15);
    });

    it("rapids penalty reduces score", () => {
      const noRapids = computeHappyScore(baseSignals(), 1);
      const withRapids = computeHappyScore(baseSignals({ rapidCount: 1 }), 1);
      // 1 rapid / 1 km * 5 = 5, so score should drop by 5
      expect(noRapids.score - withRapids.score).toBe(5);
    });

    it("elevation penalty caps at 20", () => {
      const { breakdown } = computeHappyScore(baseSignals(), 1, 100000);
      expect(breakdown.elevation).toBe(20);
    });

    it("elevation penalty is 0 when elevationGainM is not provided", () => {
      const { breakdown } = computeHappyScore(baseSignals(), 1);
      expect(breakdown.elevation).toBe(0);
    });

    it("elevation penalty is 0 when elevationGainM is null/undefined", () => {
      const { breakdown } = computeHappyScore(baseSignals(), 1, undefined);
      expect(breakdown.elevation).toBe(0);
    });

    it("elevation penalty scales with gain per km", () => {
      // 3 m gain over 1 km * multiplier 3 = 9 penalty
      const { breakdown } = computeHappyScore(baseSignals(), 1, 3);
      expect(breakdown.elevation).toBe(9);
    });

    it("motorBoat penalty caps at 12", () => {
      const { breakdown } = computeHappyScore(baseSignals({ motorBoatCount: 10000 }), 1);
      expect(breakdown.motorBoat).toBe(12);
    });

    it("motorBoat penalty reduces score", () => {
      const none = computeHappyScore(baseSignals(), 1);
      const heavy = computeHappyScore(baseSignals({ motorBoatCount: 1 }), 1);
      // 1 motorBoat / 1 km * 4 = 4
      expect(none.score - heavy.score).toBe(4);
    });
  });

  describe("normalisation — distanceKm minimum 0.5", () => {
    it("very short distance (0.1 km) clamps norm to 0.5", () => {
      // parkCount=1, norm=0.5 → (1/0.5)*12 = 24
      const { breakdown } = computeHappyScore(baseSignals({ parkCount: 1 }), 0.1);
      expect(breakdown.parks).toBe(24);
    });

    it("1 km distance uses norm=1 (no clamping needed)", () => {
      const { breakdown } = computeHappyScore(baseSignals({ parkCount: 1 }), 1);
      expect(breakdown.parks).toBe(12);
    });

    it("2 km distance halves the per-km density", () => {
      // parkCount=1, norm=2 → (1/2)*12 = 6
      const { breakdown } = computeHappyScore(baseSignals({ parkCount: 1 }), 2);
      expect(breakdown.parks).toBe(6);
    });
  });

  describe("partial penalty", () => {
    it("applies 15% penalty when partial=true", () => {
      // all zeros → raw = 5 (base). partial → Math.max(5, 5 * 0.85) = Math.max(5, 4.25) = 5
      const { score } = computeHappyScore(baseSignals({ partial: true }), 1);
      expect(score).toBe(5);
    });

    it("partial penalty is floor 5 even when raw * 0.85 < 5", () => {
      // Extreme penalties can bring raw below 5; partial floor should still be 5
      const { score } = computeHappyScore(
        baseSignals({ rapidCount: 1000, motorBoatCount: 1000, partial: true }),
        1,
        10000
      );
      expect(score).toBeGreaterThanOrEqual(5);
    });

    it("partial reduces score when raw is high", () => {
      const full = computeHappyScore(baseSignals({ parkCount: 5, waterwayCount: 5 }), 1);
      const partial = computeHappyScore(
        baseSignals({ parkCount: 5, waterwayCount: 5, partial: true }),
        1
      );
      expect(partial.score).toBeLessThan(full.score);
    });

    it("no partial penalty when partial=false", () => {
      const withPartial = computeHappyScore(
        baseSignals({ parkCount: 5, partial: true }),
        1
      );
      const withoutPartial = computeHappyScore(
        baseSignals({ parkCount: 5, partial: false }),
        1
      );
      expect(withoutPartial.score).toBeGreaterThan(withPartial.score);
    });
  });

  describe("score additive across all positive signals", () => {
    it("all caps reached → score is 100 (clamped)", () => {
      // Max possible positive: 5+30+25+20+15+10+15+8+5 = 133; clamped to 100
      const { score } = computeHappyScore(
        baseSignals({
          parkCount: 10000,
          waterwayCount: 10000,
          waterCount: 10000,
          greenCount: 10000,
          litCount: 10000,
          calmWaterCount: 10000,
          launchCount: 10000,
          portageCount: 10000,
        }),
        1
      );
      expect(score).toBe(100);
    });

    it("breakdown values are rounded integers", () => {
      const { breakdown } = computeHappyScore(
        baseSignals({ parkCount: 3, waterwayCount: 2 }),
        3
      );
      for (const val of Object.values(breakdown)) {
        expect(Number.isInteger(val)).toBe(true);
      }
    });
  });
});
