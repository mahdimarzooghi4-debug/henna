"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import styles from "./address-map-picker.module.css";

export type SelectedMapPoint = { latitude: number; longitude: number };
type Props = { value: SelectedMapPoint | null; onChange: (point: SelectedMapPoint) => void };
type MapCenter = SelectedMapPoint;

const TILE_SIZE = 256;
const DEFAULT_CENTER: MapCenter = { latitude: 32.4279, longitude: 53.6880 };
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;
const TILE_URL = process.env.NEXT_PUBLIC_HANA_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function worldPixel(point: MapCenter, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const sin = Math.sin(latitude * Math.PI / 180);
  return {
    x: ((point.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function pointFromWorld(x: number, y: number, zoom: number): MapCenter {
  const scale = TILE_SIZE * 2 ** zoom;
  const wrappedX = ((x % scale) + scale) % scale;
  const boundedY = Math.max(0, Math.min(scale, y));
  const longitude = wrappedX / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * boundedY / scale;
  const latitude = 180 / Math.PI * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

export function AddressMapPicker({ value, onChange }: Props) {
  const [center, setCenter] = useState<MapCenter>(value ?? DEFAULT_CENTER);
  const [zoom, setZoom] = useState(12);
  const [dragging, setDragging] = useState(false);
  const [mapError, setMapError] = useState("");
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const pixels = worldPixel(center, zoom);
  const tileX = Math.floor(pixels.x / TILE_SIZE);
  const tileY = Math.floor(pixels.y / TILE_SIZE);
  const fractionalX = pixels.x - tileX * TILE_SIZE;
  const fractionalY = pixels.y - tileY * TILE_SIZE;
  const tiles = useMemo(() => {
    const count = 2 ** zoom;
    return [-1, 0, 1].flatMap((row) => [-1, 0, 1].map((column) => {
      const x = ((tileX + column) % count + count) % count;
      const y = tileY + row;
      return { key: `${zoom}/${x}/${y}`, url: TILE_URL.replace("{z}", String(zoom)).replace("{x}", String(x)).replace("{y}", String(y)),
        left: column * TILE_SIZE - fractionalX, top: row * TILE_SIZE - fractionalY, valid: y >= 0 && y < count };
    }));
  }, [fractionalX, fractionalY, tileX, tileY, zoom]);

  function changeCenter(next: MapCenter) {
    setCenter(next);
    onChange(next);
    setMapError("");
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointer.current) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    pointer.current = { x: event.clientX, y: event.clientY };
    const current = worldPixel(center, zoom);
    changeCenter(pointFromWorld(current.x - dx, current.y - dy, zoom));
  }

  function finishDrag() {
    pointer.current = null;
    setDragging(false);
  }

  function useDeviceLocation() {
    setMapError("");
    if (!navigator.geolocation) {
      setMapError("مرورگر شما امکان دریافت موقعیت را ندارد. نقشه را جابه‌جا کنید.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => { setZoom(16); changeCenter({ latitude: position.coords.latitude, longitude: position.coords.longitude }); },
      () => setMapError("دسترسی به موقعیت دستگاه داده نشد. می‌توانید نقشه را دستی جابه‌جا کنید."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  return <section className={styles.section} aria-labelledby="map-title">
    <div className={styles.heading}><h3 id="map-title">تعیین موقعیت روی نقشه</h3><button type="button" onClick={useDeviceLocation}>استفاده از موقعیت دستگاه</button></div>
    <div className={styles.map} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} data-dragging={dragging} aria-label="برای انتخاب موقعیت، نقشه را جابه‌جا کنید">
      {tiles.map((tile) => tile.valid && <img key={tile.key} src={tile.url} alt="" draggable={false} className={styles.tile} style={{ left: `calc(50% + ${tile.left}px)`, top: `calc(50% + ${tile.top}px)` }} />)}
      <span className={styles.pin} aria-hidden="true">●</span>
      <div className={styles.zoomControls}>
        <button type="button" aria-label="بزرگ‌نمایی نقشه" onPointerDown={(event) => event.stopPropagation()} onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + 1))}>+</button>
        <button type="button" aria-label="کوچک‌نمایی نقشه" onPointerDown={(event) => event.stopPropagation()} onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - 1))}>−</button>
      </div>
      <span className={styles.attribution}>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</span>
    </div>
    <p className={styles.help}>{value ? "نشان را با جابه‌جا کردن نقشه روی محل دقیق قرار دهید." : "نقشه را جابه‌جا کنید یا موقعیت دستگاه را بگیرید؛ این نقطه تا ثبت آدرس انتخاب محسوب نمی‌شود."}</p>
    {mapError && <p className={styles.error} role="status">{mapError}</p>}
  </section>;
}
