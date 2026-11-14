export type GuideRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};
export type GuideViewport = GuideRect;
const right = (r: GuideRect) => r.left + r.width;
const bottom = (r: GuideRect) => r.top + r.height;
export function intersect(a: GuideRect, b: GuideRect): GuideRect | null {
  const left = Math.max(a.left, b.left),
    top = Math.max(a.top, b.top);
  const width = Math.min(right(a), right(b)) - left,
    height = Math.min(bottom(a), bottom(b)) - top;
  return width > 1 && height > 1 ? { left, top, width, height } : null;
}
const area = (r: GuideRect | null) => (r ? r.width * r.height : 0);
/** Prefer a card outside the highlighted control, then minimize overlap for huge targets. */
export function placeGuideCard(
  target: GuideRect | null,
  size: { width: number; height: number },
  viewport: GuideViewport,
): GuideRect {
  const pad = 12,
    gap = 18;
  const width = Math.min(size.width, Math.max(1, viewport.width - pad * 2)),
    height = Math.min(size.height, Math.max(1, viewport.height - pad * 2));
  const clamp = (left: number, top: number): GuideRect => ({
    left: Math.max(
      viewport.left + pad,
      Math.min(left, right(viewport) - width - pad),
    ),
    top: Math.max(
      viewport.top + pad,
      Math.min(top, bottom(viewport) - height - pad),
    ),
    width,
    height,
  });
  if (!target)
    return clamp(
      viewport.left + (viewport.width - width) / 2,
      bottom(viewport) - height - pad,
    );
  const cx = target.left + target.width / 2,
    cy = target.top + target.height / 2;
  const candidates = [
    clamp(cx - width / 2, bottom(target) + gap),
    clamp(cx - width / 2, target.top - height - gap),
    clamp(right(target) + gap, cy - height / 2),
    clamp(target.left - width - gap, cy - height / 2),
    clamp(viewport.left + pad, viewport.top + pad),
    clamp(right(viewport) - width - pad, viewport.top + pad),
    clamp(viewport.left + pad, bottom(viewport) - height - pad),
    clamp(right(viewport) - width - pad, bottom(viewport) - height - pad),
  ];
  const expanded = {
    left: target.left - 8,
    top: target.top - 8,
    width: target.width + 16,
    height: target.height + 16,
  };
  return candidates
    .map((rect, index) => ({
      rect,
      score:
        area(intersect(rect, expanded)) * 1000 +
        Math.hypot(rect.left + width / 2 - cx, rect.top + height / 2 - cy) +
        index * 0.01,
    }))
    .sort((a, b) => a.score - b.score)[0].rect;
}
/** Segment between the nearest boundaries, never a line through the target content. */
export function guideArrow(card: GuideRect, target: GuideRect) {
  const a = { x: card.left + card.width / 2, y: card.top + card.height / 2 },
    b = {
      x: target.left + target.width / 2,
      y: target.top + target.height / 2,
    };
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const scale = (r: GuideRect) =>
    Math.min(
      Math.abs(dx) > 0 ? r.width / 2 / Math.abs(dx) : Infinity,
      Math.abs(dy) > 0 ? r.height / 2 / Math.abs(dy) : Infinity,
    );
  const ca = scale(card),
    tb = scale(target);
  return {
    x1: a.x + dx * ca,
    y1: a.y + dy * ca,
    x2: b.x - dx * tb,
    y2: b.y - dy * tb,
  };
}
