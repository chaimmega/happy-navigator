import { describe, it, expect } from "vitest";
import { parseGoogleMapsUrl } from "../parseGoogleMapsUrl";

describe("parseGoogleMapsUrl", () => {
  describe("Format 1 — path-based /maps/dir/Start/End", () => {
    it("parses start and end from path segments", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/Central+Park,+New+York/Brooklyn+Bridge/@40.7,-74.0,12z"
      );
      expect(result).not.toBeNull();
      expect(result?.start).toBe("Central Park, New York");
      expect(result?.end).toBe("Brooklyn Bridge");
    });

    it("decodes + signs to spaces", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/Times+Square/Battery+Park"
      );
      expect(result?.start).toBe("Times Square");
      expect(result?.end).toBe("Battery Park");
    });

    it("decodes percent-encoded characters (%20 → space)", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/Central%20Park/Brooklyn%20Bridge"
      );
      expect(result?.start).toBe("Central Park");
      expect(result?.end).toBe("Brooklyn Bridge");
    });

    it("strips the @lat,lng,zoom segment", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/Start+Place/End+Place/@51.5,0.0,10z"
      );
      expect(result?.start).toBe("Start Place");
      expect(result?.end).toBe("End Place");
    });

    it("picks first segment as start and last as end when multiple waypoints", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/A/B/C/@40.0,-74.0,12z"
      );
      expect(result?.start).toBe("A");
      expect(result?.end).toBe("C");
    });

    it("returns null when only one path segment (no destination)", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/OnlyStart/@40.7,-74.0,12z"
      );
      expect(result).toBeNull();
    });
  });

  describe("Format 2 — query param origin/destination", () => {
    it("parses origin and destination query params", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/?api=1&origin=Times+Square&destination=Battery+Park"
      );
      expect(result).not.toBeNull();
      expect(result?.start).toBe("Times Square");
      expect(result?.end).toBe("Battery Park");
    });

    it("handles encoded spaces in query params", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/?api=1&origin=Central%20Park&destination=Brooklyn%20Bridge"
      );
      expect(result?.start).toBe("Central Park");
      expect(result?.end).toBe("Brooklyn Bridge");
    });

    it("returns null when destination param is missing", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/?api=1&origin=Times+Square"
      );
      expect(result).toBeNull();
    });

    it("returns null when origin param is missing", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/dir/?api=1&destination=Battery+Park"
      );
      expect(result).toBeNull();
    });
  });

  describe("non-Google URLs", () => {
    it("returns null for a non-Google URL", () => {
      const result = parseGoogleMapsUrl("https://www.openstreetmap.org/directions");
      expect(result).toBeNull();
    });

    it("returns null for a Bing Maps URL", () => {
      const result = parseGoogleMapsUrl(
        "https://www.bing.com/maps?rtp=adr.New+York~adr.Brooklyn"
      );
      expect(result).toBeNull();
    });

    it("returns null for maps.app.goo.gl shortened URL (no redirect following)", () => {
      const result = parseGoogleMapsUrl("https://maps.app.goo.gl/abc123");
      expect(result).toBeNull();
    });
  });

  describe("invalid / edge-case inputs", () => {
    it("returns null for a completely invalid URL string", () => {
      const result = parseGoogleMapsUrl("not a url at all");
      expect(result).toBeNull();
    });

    it("returns null for an empty string", () => {
      const result = parseGoogleMapsUrl("");
      expect(result).toBeNull();
    });

    it("returns null for a plain Google URL with no /maps/dir path", () => {
      const result = parseGoogleMapsUrl("https://www.google.com");
      expect(result).toBeNull();
    });

    it("returns null for a Google Maps search URL (no directions)", () => {
      const result = parseGoogleMapsUrl(
        "https://www.google.com/maps/search/Central+Park"
      );
      expect(result).toBeNull();
    });
  });
});
