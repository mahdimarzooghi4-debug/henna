export const MAP_TILE_SIZE = 256;
export const MAP_MIN_ZOOM = 4;
export const MAP_MAX_ZOOM = 18;
export const IRAN_MAP_OVERVIEW = Object.freeze({
  latitude: 32.4279,
  longitude: 53.688,
});

export type MapPoint = {
  latitude: number;
  longitude: number;
};

export type MapTile = {
  key: string;
  zoom: number;
  x: number;
  y: number;
  left: number;
  top: number;
};

const maxLatitude = 85.05112878;

const clampLatitude = (value: number) =>
  Math.max(-maxLatitude, Math.min(maxLatitude, value));

const wrapLongitude = (value: number) =>
  ((value + 180) % 360 + 360) % 360 - 180;

export function validMapPoint(value: unknown): value is MapPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const x = value as Record<string, unknown>;
  return typeof x.latitude === "number" &&
    Number.isFinite(x.latitude) && x.latitude >= -90 && x.latitude <= 90 &&
    typeof x.longitude === "number" &&
    Number.isFinite(x.longitude) && x.longitude >= -180 && x.longitude <= 180;
}

export function projectMapPoint(point: MapPoint, zoom: number) {
  if (!validMapPoint(point) || !Number.isInteger(zoom) ||
      zoom < MAP_MIN_ZOOM || zoom > MAP_MAX_ZOOM)
    throw Error("Invalid map projection input.");
  const scale = MAP_TILE_SIZE * 2 ** zoom;
  const latitude = clampLatitude(point.latitude) * Math.PI / 180;
  const x = (wrapLongitude(point.longitude) + 180) / 360 * scale;
  const y = (0.5 -
    Math.log((1 + Math.sin(latitude)) / (1 - Math.sin(latitude))) /
      (4 * Math.PI)) * scale;
  return { x, y };
}

export function unprojectMapPoint(x: number, y: number, zoom: number): MapPoint {
  if (!Number.isFinite(x) || !Number.isFinite(y) ||
      !Number.isInteger(zoom) || zoom < MAP_MIN_ZOOM || zoom > MAP_MAX_ZOOM)
    throw Error("Invalid map inverse projection input.");
  const scale = MAP_TILE_SIZE * 2 ** zoom;
  const longitude = wrapLongitude(x / scale * 360 - 180);
  const n = Math.PI - 2 * Math.PI * y / scale;
  const latitude = clampLatitude(180 / Math.PI * Math.atan(Math.sinh(n)));
  return { latitude, longitude };
}

export function mapPointFromPixel(
  center: MapPoint,
  zoom: number,
  width: number,
  height: number,
  pixelX: number,
  pixelY: number,
): MapPoint {
  if (![width, height, pixelX, pixelY].every(Number.isFinite) ||
      width <= 0 || height <= 0 ||
      pixelX < 0 || pixelX > width || pixelY < 0 || pixelY > height)
    throw Error("Invalid map pixel.");
  const world = projectMapPoint(center, zoom);
  return unprojectMapPoint(
    world.x + pixelX - width / 2,
    world.y + pixelY - height / 2,
    zoom,
  );
}

export function mapTiles(
  center: MapPoint,
  zoom: number,
  width: number,
  height: number,
  padding = 1,
): MapTile[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width <= 0 || height <= 0 ||
      !Number.isInteger(padding) || padding < 0 || padding > 2)
    throw Error("Invalid map viewport.");
  const world = projectMapPoint(center, zoom);
  const left = world.x - width / 2;
  const top = world.y - height / 2;
  const firstX = Math.floor(left / MAP_TILE_SIZE) - padding;
  const lastX = Math.floor((left + width) / MAP_TILE_SIZE) + padding;
  const firstY = Math.floor(top / MAP_TILE_SIZE) - padding;
  const lastY = Math.floor((top + height) / MAP_TILE_SIZE) + padding;
  const count = 2 ** zoom;
  const tiles: MapTile[] = [];
  for (let rawY = firstY; rawY <= lastY; rawY++) {
    if (rawY < 0 || rawY >= count) continue;
    for (let rawX = firstX; rawX <= lastX; rawX++) {
      const x = ((rawX % count) + count) % count;
      tiles.push({
        key: `${zoom}/${rawX}/${rawY}`,
        zoom,
        x,
        y: rawY,
        left: rawX * MAP_TILE_SIZE - left,
        top: rawY * MAP_TILE_SIZE - top,
      });
    }
  }
  return tiles;
}

export function osmTileUrl(tile: Pick<MapTile, "zoom" | "x" | "y">) {
  return `https://tile.openstreetmap.org/${tile.zoom}/${tile.x}/${tile.y}.png`;
}
