import assert from "node:assert/strict";
import test from "node:test";
import {
  IRAN_MAP_OVERVIEW,
  mapPointFromPixel,
  mapTiles,
  osmTileUrl,
  projectMapPoint,
  unprojectMapPoint,
  validMapPoint,
} from "../packages/buyer-commerce/map-tiles.ts";

test("web mercator map helpers round-trip bounded coordinates", () => {
  const point = { latitude: 35.6892, longitude: 51.389 };
  const projected = projectMapPoint(point, 12);
  const restored = unprojectMapPoint(projected.x, projected.y, 12);
  assert.ok(Math.abs(restored.latitude - point.latitude) < 0.000001);
  assert.ok(Math.abs(restored.longitude - point.longitude) < 0.000001);
  assert.deepEqual(mapPointFromPixel(point, 12, 640, 320, 320, 160),
    point);
});

test("tile viewport wraps longitude and emits only valid OSM tile rows", () => {
  const tiles = mapTiles(
    { latitude: 0, longitude: 179.99 }, 4, 640, 320, 1);
  assert.ok(tiles.length >= 12);
  assert.ok(tiles.every(tile =>
    tile.x >= 0 && tile.x < 16 && tile.y >= 0 && tile.y < 16));
  assert.match(osmTileUrl(tiles[0]),
    /^https:\/\/tile\.openstreetmap\.org\/4\/\d+\/\d+\.png$/);
});

test("map point validation rejects out-of-range persisted coordinates", () => {
  assert.equal(validMapPoint(IRAN_MAP_OVERVIEW), true);
  assert.equal(validMapPoint({ latitude: 91, longitude: 51 }), false);
  assert.equal(validMapPoint({ latitude: 35, longitude: 181 }), false);
  assert.equal(validMapPoint({ latitude: Number.NaN, longitude: 51 }), false);
});
