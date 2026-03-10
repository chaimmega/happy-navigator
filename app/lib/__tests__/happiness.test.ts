import { describe, it, expect } from "vitest";
import { computeHappyScore } from "../happiness";
import type { HappinessSignals } from "../../types";

/** Minimal zeroed signals — set only the fields you care about in each test */
function baseSignals(overrides: Partial<HappinessSignals> = {}): HappinessSignals {
  return {
    parkCount: 0,
    waterfrontCount: 0,
    scenicRoadCount: 0,
    greenCount: 0,
    litCount: 0,
    lowTrafficCount: 0,
    constructionCount: 0,
    restStopCount: 0,
    viewpointCount: 0,
    highwayCount: 0,
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
        baseSignals({ constructionCount: 1000, highwayCount: 1000 }),
        1,
        10000
      );
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("score never exceeds 100", () => {
      const { score } = computeHappyScore(
        baseSignals({
          parkCount: 10000,
          waterfrontCount: 10000,
          scenicRoadCount: 10000,
          greenCount: 10000,
          litCount: 10000,
          lowTrafficCount: 10000,
          restStopCount: 10000,
          viewpointCount: 10000,
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
      const { breakdown } = computeHappyScore(baseSignals({ parkCount: 10000 }), 1);
      expect(breakdown.parks).toBe(30);
    });

    it("parks below cap scales linearly", () => {
      // 1 park per km * multiplier 12 = 12, well below cap 30
      const { breakdown } = computeHappyScore(baseSignals({ parkCount: 1 }), 1);
      expect(breakdown.parks).toBe(12);
    });
  });

  describe("scenicRoads cap", () => {
    it("scenicRoads contribution caps at 25", () => {
      const { breakdown } = computeHappyScore(baseSignals({ scenicRoadCount: 10000 }), 1);
      expect(breakdown.scenicRoads).toBe(25);
    });

    it("scenicRoads below cap scales correctly", () => {
      // 1 scenic road / 1 km * 10 = 10
      const { breakdown } = computeHappyScore(baseSignals({ scenicRoadCount: 1 }), 1);
      expect(breakdown.scenicRoads).toBe(10);
    });
  });

  describe("waterfront cap", () => {
    it("waterfront contribution caps at 20", () => {
      const { breakdown } = computeHappyScore(baseSignals({ waterfrontCount: 10000 }), 1);
      expect(breakdown.waterfront).toBe(20);
    });

    it("waterfront below cap scales correctly", () => {
      // 1 waterfront / 1 km * 8 = 8
      const { breakdown } = computeHappyScore(baseSignals({ waterfrontCount: 1 }), 1);
      expect(breakdown.waterfront).toBe(8);
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

  describe("lowTraffic cap", () => {
    it("lowTraffic contribution caps at 15", () => {
      const { breakdown } = computeHappyScore(baseSignals({ lowTrafficCount: 10000 }), 1);
      expect(breakdown.lowTraffic).toBe(15);
    });

    it("lowTraffic below cap scales correctly", () => {
      // 1 lowTraffic / 1 km * 6 = 6
      const { breakdown } = computeHappyScore(baseSignals({ lowTrafficCount: 1 }), 1);
      expect(breakdown.lowTraffic).toBe(6);
    });
  });

  describe("restStops cap", () => {
    it("restStops contribution caps at 8", () => {
      const { breakdown } = computeHappyScore(baseSignals({ restStopCount: 10000 }), 1);
      expect(breakdown.restStops).toBe(8);
    });

    it("restStops below cap scales correctly", () => {
      // 1 restStop / 1 km * 3 = 3
      const { breakdown } = computeHappyScore(baseSignals({ restStopCount: 1 }), 1);
      expect(breakdown.restStops).toBe(3);
    });
  });

  describe("viewpoints cap", () => {
    it("viewpoints contribution caps at 5", () => {
      const { breakdown } = computeHappyScore(baseSignals({ viewpointCount: 10000 }), 1);
      expect(breakdown.viewpoints).toBe(5);
    });

    it("viewpoints below cap scales correctly", () => {
      // 1 viewpoint / 1 km * 2 = 2
      const { breakdown } = computeHappyScore(baseSignals({ viewpointCount: 1 }), 1);
      expect(breakdown.viewpoints).toBe(2);
    });
  });

  describe("penalties", () => {
    it("construction penalty caps at 15", () => {
      const { breakdown } = computeHappyScore(baseSignals({ constructionCount: 10000 }), 1);
      expect(breakdown.construction).toBe(15);
    });

    it("construction penalty reduces score", () => {
      const none = computeHappyScore(baseSignals(), 1);
      const withConstruction = computeHappyScore(baseSignals({ constructionCount: 1 }), 1);
      // 1 construction / 1 km * 5 = 5, so score should drop by 5
      expect(none.score - withConstruction.score).toBe(5);
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

    it("highway penalty caps at 12", () => {
      const { breakdown } = computeHappyScore(baseSignals({ highwayCount: 10000 }), 1);
      expect(breakdown.highway).toBe(12);
    });

    it("highway penalty reduces score", () => {
      const none = computeHappyScore(baseSignals(), 1);
      const heavy = computeHappyScore(baseSignals({ highwayCount: 1 }), 1);
      // 1 highway / 1 km * 4 = 4
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
      const { score } = computeHappyScore(
        baseSignals({ constructionCount: 1000, highwayCount: 1000, partial: true }),
        1,
        10000
      );
      expect(score).toBeGreaterThanOrEqual(5);
    });

    it("partial reduces score when raw is high", () => {
      const full = computeHappyScore(baseSignals({ parkCount: 5, scenicRoadCount: 5 }), 1);
      const partial = computeHappyScore(
        baseSignals({ parkCount: 5, scenicRoadCount: 5, partial: true }),
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
      // Max possible positive: 5+30+25+20+15+15+10+8+5 = 133; clamped to 100
      const { score } = computeHappyScore(
        baseSignals({
          parkCount: 10000,
          scenicRoadCount: 10000,
          waterfrontCount: 10000,
          greenCount: 10000,
          litCount: 10000,
          lowTrafficCount: 10000,
          restStopCount: 10000,
          viewpointCount: 10000,
        }),
        1
      );
      expect(score).toBe(100);
    });

    it("breakdown values are rounded integers", () => {
      const { breakdown } = computeHappyScore(
        baseSignals({ parkCount: 3, scenicRoadCount: 2 }),
        3
      );
      for (const val of Object.values(breakdown)) {
        expect(Number.isInteger(val)).toBe(true);
      }
    });
  });
});
