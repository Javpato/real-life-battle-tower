import { describe, it, expect } from "vitest";
import {
  intersect,
  placeGuideCard,
  guideArrow,
  type GuideRect,
} from "../src/tutorial/layout";
import {
  GUIDE_CATALOG,
  GUIDE_SCOPES,
  getGuideSteps,
} from "../src/tutorial/catalog";
describe("guided tutorial geometry", () => {
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [844, 390],
    [390, 844],
  ]) {
    it(`keeps control and callout separate within ${width}×${height}`, () => {
      const viewport = { left: 0, top: 0, width, height };
      for (const target of [
        { left: 10, top: 10, width: 80, height: 44 },
        { left: width - 150, top: height - 70, width: 130, height: 50 },
        { left: width / 2 - 60, top: height / 2 - 22, width: 120, height: 44 },
      ]) {
        const card = placeGuideCard(
          target,
          { width: 340, height: 160 },
          viewport,
        );
        expect(card.left).toBeGreaterThanOrEqual(0);
        expect(card.top).toBeGreaterThanOrEqual(0);
        expect(card.left + card.width).toBeLessThanOrEqual(width);
        expect(card.top + card.height).toBeLessThanOrEqual(height);
        expect(intersect(card, target)).toBeNull();
        for (const value of Object.values(guideArrow(card, target)))
          expect(Number.isFinite(value)).toBe(true);
      }
    });
  }
  it("places missing-target guidance safely in the visual viewport", () => {
    const v = { left: 20, top: 30, width: 390, height: 400 },
      r = placeGuideCard(null, { width: 340, height: 140 }, v);
    expect(r.left).toBeGreaterThanOrEqual(32);
    expect(r.top + r.height).toBeLessThanOrEqual(418);
  });
  it("does not produce invalid SVG coordinates for coinciding centers", () => {
    const r: GuideRect = { left: 0, top: 0, width: 100, height: 100 };
    for (const value of Object.values(guideArrow(r, r)))
      expect(Number.isFinite(value)).toBe(true);
  });
});
describe("read-only help catalog", () => {
  it("gives every scope unique explanatory steps with missing-target guidance", () => {
    const ids = new Set<string>();
    for (const section of GUIDE_SCOPES) {
      expect(getGuideSteps(section.id)).toBe(GUIDE_CATALOG[section.id].steps);
      expect(section.steps.length).toBeGreaterThan(1);
      for (const step of section.steps) {
        expect(ids.has(step.id)).toBe(false);
        ids.add(step.id);
        expect(step.target).toBeTruthy();
        expect(step.missingTargetBody).toBeTruthy();
        expect(step.body.length).toBeGreaterThan(20);
      }
    }
  });
});
