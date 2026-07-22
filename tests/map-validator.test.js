import test from "node:test";
import assert from "node:assert/strict";

import { generateMap } from "../src/game/map/map-generator.js";
import { getAllRoutes, validateMap } from "../src/game/map/map-validator.js";

test("les cartes générées respectent les règles principales", () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const map = generateMap({ seed });
    const validation = validateMap(map);
    assert.equal(validation.valid, true, `seed ${seed}: ${validation.errors.join(" | ")}`);
    assert.equal(map.rows.length, 13);

    const routes = getAllRoutes(map);
    assert.ok(routes.length > 0);

    for (const route of routes) {
      const playable = route.filter((node) => node.type !== "start");
      assert.equal(playable[0]?.difficulty, "warmup");
      assert.equal(route.at(-1)?.type, "boss");
      assert.ok(route.some((node) => node.type === "elite"));
    }
  }
});
