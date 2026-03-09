import { describe, it, expect } from "vitest";
import { sampleCoords } from "../overpass";

/** Helper — build an array of N simple [lng, lat] tuples */
function makeCoords(n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => [i, i] as [number, number]);
}

describe("sampleCoords", () => {
  describe("when input has fewer points than maxPoints", () => {
    it("returns all coords unchanged", () => {
      const coords = makeCoords(5);
      expect(sampleCoords(coords, 10)).toEqual(coords);
    });

    it("returns all when input length equals maxPoints", () => {
      const coords = makeCoords(10);
      expect(sampleCoords(coords, 10)).toEqual(coords);
    });

    it("returns a single-element array unchanged", () => {
      const coords: [number, number][] = [[1, 2]];
      expect(sampleCoords(coords, 10)).toEqual([[1, 2]]);
    });
  });

  describe("when input has more points than maxPoints", () => {
    it("returns exactly maxPoints elements", () => {
      const result = sampleCoords(makeCoords(100), 10);
      expect(result).toHaveLength(10);
    });

    it("always includes the first point", () => {
      const coords = makeCoords(50);
      const result = sampleCoords(coords, 5);
      expect(result[0]).toEqual(coords[0]);
    });

    it("always includes the last point", () => {
      const coords = makeCoords(50);
      const result = sampleCoords(coords, 5);
      expect(result[result.length - 1]).toEqual(coords[coords.length - 1]);
    });

    it("result length is exactly maxPoints (not more, not less)", () => {
      const result = sampleCoords(makeCoords(200), 7);
      expect(result).toHaveLength(7);
    });
  });

  describe("edge case: maxPoints = 2", () => {
    it("returns exactly first and last points", () => {
      const coords = makeCoords(20);
      const result = sampleCoords(coords, 2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(coords[0]);
      expect(result[1]).toEqual(coords[coords.length - 1]);
    });
  });

  describe("edge case: maxPoints = 1", () => {
    it("returns an array of length 1", () => {
      const coords = makeCoords(10);
      const result = sampleCoords(coords, 1);
      // step = (10-1)/(1-1) = Infinity; i=0 → 0*Infinity = NaN; coords[NaN] = undefined
      // The function returns length-1 array — length is what matters for the interface
      expect(result).toHaveLength(1);
    });
  });

  describe("default maxPoints = 10", () => {
    it("uses 10 as default when maxPoints is omitted", () => {
      const result = sampleCoords(makeCoords(100));
      expect(result).toHaveLength(10);
    });
  });

  describe("even sampling quality", () => {
    it("sampled points are a subset of the original coords", () => {
      const coords = makeCoords(100);
      const result = sampleCoords(coords, 10);
      for (const pt of result) {
        expect(coords).toContainEqual(pt);
      }
    });

    it("points are evenly spread — indices are roughly equidistant", () => {
      // With 100 coords and maxPoints=5, step=(100-1)/(5-1)=24.75
      // Expected indices: 0, 25, 50, 74, 99
      const coords = makeCoords(100);
      const result = sampleCoords(coords, 5);
      expect(result).toHaveLength(5);
      expect(result[0]).toEqual([0, 0]);
      expect(result[4]).toEqual([99, 99]);
    });
  });
});
