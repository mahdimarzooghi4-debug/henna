"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IRAN_MAP_OVERVIEW,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_SIZE,
  mapPointFromPixel,
  mapTiles,
  osmTileUrl,
  validMapPoint,
  type MapPoint,
} from "../../../packages/buyer-commerce/map-tiles";

export function CoordinateMapPicker({
  value,
  onChange,
  disabled = false,
  label = "انتخاب موقعیت روی نقشه",
}: {
  value: MapPoint | null;
  onChange: (point: MapPoint) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(6);
  const [width, setWidth] = useState(640);
  const [center, setCenter] = useState<MapPoint>(
    validMapPoint(value) ? value : IRAN_MAP_OVERVIEW,
  );
  const viewport = useRef<HTMLDivElement>(null);
  const height = 300;

  useEffect(() => {
    if (validMapPoint(value)) setCenter(value);
  }, [value]);

  useEffect(() => {
    if (!open || !viewport.current) return;
    const element = viewport.current;
    const update = () => setWidth(Math.max(280, element.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  const tiles = useMemo(
    () => open ? mapTiles(center, zoom, width, height, 1) : [],
    [center, height, open, width, zoom],
  );

  function choose(event: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const box = event.currentTarget.getBoundingClientRect();
    const point = mapPointFromPixel(
      center, zoom, box.width, box.height,
      event.clientX - box.left, event.clientY - box.top,
    );
    const normalized = {
      latitude: Number(point.latitude.toFixed(6)),
      longitude: Number(point.longitude.toFixed(6)),
    };
    setCenter(normalized);
    onChange(normalized);
  }

  if (!open) {
    return (
      <div className="coordinate-map-picker coordinate-map-picker--closed">
        <button type="button" className="commerce-button commerce-button--secondary"
          disabled={disabled} onClick={() => setOpen(true)}>
          باز کردن نقشه
        </button>
        <p>
          نقشه فقط پس از اقدام شما بارگیری می‌شود. انتخاب نقطه، اثبات پوشش
          ارسال یا سرویس‌پذیری نیست.
        </p>
      </div>
    );
  }

  return (
    <div className="coordinate-map-picker">
      <div className="coordinate-map-picker__toolbar">
        <button type="button" disabled={disabled || zoom >= MAP_MAX_ZOOM}
          aria-label="بزرگ‌نمایی نقشه"
          onClick={() => setZoom(value => Math.min(MAP_MAX_ZOOM, value + 1))}>
          +
        </button>
        <button type="button" disabled={disabled || zoom <= MAP_MIN_ZOOM}
          aria-label="کوچک‌نمایی نقشه"
          onClick={() => setZoom(value => Math.max(MAP_MIN_ZOOM, value - 1))}>
          −
        </button>
        <button type="button" disabled={disabled}
          onClick={() => setOpen(false)}>
          بستن نقشه
        </button>
      </div>
      <div ref={viewport}
        className="coordinate-map-picker__viewport"
        role="application"
        aria-label={label}
        aria-disabled={disabled}
        onClick={choose}>
        {tiles.map(tile => (
          <img key={tile.key} src={osmTileUrl(tile)} alt=""
            draggable={false} referrerPolicy="no-referrer"
            width={MAP_TILE_SIZE} height={MAP_TILE_SIZE}
            style={{
              position: "absolute",
              width: MAP_TILE_SIZE,
              height: MAP_TILE_SIZE,
              left: tile.left,
              top: tile.top,
            }} />
        ))}
        <span className="coordinate-map-picker__pin" aria-hidden="true">⌖</span>
      </div>
      <div className="coordinate-map-picker__footer">
        <span>
          {validMapPoint(value)
            ? `مختصات انتخاب‌شده: ${value.latitude.toFixed(6)}، ${value.longitude.toFixed(6)}`
            : "برای ثبت مختصات روی نقشه کلیک کنید."}
        </span>
        <a href="https://www.openstreetmap.org/copyright"
          target="_blank" rel="noreferrer">
          © OpenStreetMap contributors
        </a>
      </div>
    </div>
  );
}
