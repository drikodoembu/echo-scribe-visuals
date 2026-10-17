import { describe, expect, test } from "bun:test";
import { sceneCount, sceneBatches, imageStyle } from "./image-plan";
import { scriptSaveFields } from "./script-save";

describe("narration-relative image count", () => {
  test("does not cap a long narration at 10 or 20 scenes", () => {
    expect(sceneCount(413, 6)).toBe(69);
  });
  test("uses the selected time per image", () => {
    expect(sceneCount(413, 10)).toBe(42);
  });
  test("keeps the last partial scene", () => {
    expect(sceneCount(61, 6)).toBe(11);
  });
  test("batching does not drop scenes", () => {
    const batches = sceneBatches(69);
    expect(batches.reduce((n, b) => n + b.count, 0)).toBe(69);
    expect(batches.at(-1)).toEqual({ start: 60, count: 9 });
  });
  test("selected non-photographic style reaches the prompt", () => {
    expect(imageStyle("anime").prompt).toContain("anime illustration");
    expect(imageStyle("watercolor").prompt).toContain("Watercolor");
  });
});

test("a pasted script saves without requiring generation fields", () => {
  expect(scriptSaveFields("", "", "Uma carta chegou. Ela sorriu.")).toEqual({
    title: "Uma carta chegou.", topic: "Uma carta chegou.", content: "Uma carta chegou. Ela sorriu.",
  });
});
test("explicit script fields and content are preserved", () => {
  expect(scriptSaveFields("Carta", "Família", "Texto integral")).toEqual({ title: "Carta", topic: "Família", content: "Texto integral" });
});