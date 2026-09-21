"use client";

import { useEffect, useState } from "react";
import {
  formatSellerReferenceCity,
  getSellerReferenceCities, getSellerReferenceProvinces,
  type ReferenceCity, type ReferenceProvince, type ReferenceResult,
} from "../../../lib/seller-location-reference";

type ReferenceView<T> = ReferenceResult<T> |
  { status: "idle" | "loading"; items: T[] };

type SellerLocationReferenceProps = {
  enabled: boolean;
  onChoose: (value: string) => void;
};

/**
 * Optional reference assist INSIDE the existing Figma-approved seller step.
 * The stored field remains editable TEXT: the location reference is NOT
 * seller coverage, launch entitlement or a cityId saved to the draft.
 */
export function SellerLocationReference({
  enabled, onChoose,
}: SellerLocationReferenceProps) {
  const [open, setOpen] = useState(false);
  const [provinceTry, setProvinceTry] = useState(0);
  const [citiesTry, setCitiesTry] = useState(0);
  const [provinces, setProvinces] = useState<ReferenceView<ReferenceProvince>>({
    status: "idle", items: [],
  });
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [citiesFor, setCitiesFor] = useState("");
  const [cities, setCities] = useState<ReferenceView<ReferenceCity>>({
    status: "idle", items: [],
  });
  const [selectedCityId, setSelectedCityId] = useState("");

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  useEffect(() => {
    if (!open || !enabled) return;
    const controller = new AbortController();
    setProvinces({ status: "loading", items: [] });
    void getSellerReferenceProvinces(fetch, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProvinces(result);
      });
    return () => controller.abort();
  }, [open, enabled, provinceTry]);

  const province = provinces.status === "ok"
    ? provinces.items.find((item) => item.id === selectedProvinceId)
    : undefined;

  useEffect(() => {
    if (!open || !enabled || !province) return;
    const controller = new AbortController();
    setCitiesFor(province.id);
    setCities({ status: "loading", items: [] });
    void getSellerReferenceCities(province.id, fetch, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setCities(result);
      });
    return () => controller.abort();
  }, [open, enabled, province?.id, citiesTry]);

  const citiesReady = province && citiesFor === province.id &&
    cities.status === "ok";
  const city = citiesReady
    ? cities.items.find((item) => item.id === selectedCityId)
    : undefined;
  const candidate = province && city
    ? formatSellerReferenceCity(province, city)
    : null;

  function chooseProvince(id: string) {
    setSelectedProvinceId(id);
    setSelectedCityId("");
    setCitiesFor("");
    setCities({ status: "idle", items: [] });
    setCitiesTry(0);
  }

  return (
    <div className="seller-location-reference">
      <button type="button" className="seller-location-reference__toggle"
        aria-expanded={open} aria-controls="seller-location-reference-panel"
        disabled={!enabled}
        onClick={() => setOpen((old) => !old)}>
        {open ? "بستن راهنمای شهرهای مرجع" : "راهنمای اختیاری استان و شهر"}
      </button>
      {open && (
        <div id="seller-location-reference-panel"
          className="seller-location-reference__panel">
          <p id="seller-location-reference-help">
            فقط برای کمک به نوشتن شهر / منطقهٔ فروشگاه است.
            انتخاب شهر به معنی فعال بودن فروش، ارسال سفارش یا
            پوشش حنا در آن شهر نیست؛ هنوز می‌توانید متن را دستی بنویسید.
          </p>
          {provinces.status === "loading" && (
            <p role="status">در حال دریافت استان‌ها از سرور حنا…</p>
          )}
          {provinces.status === "unavailable" && (
            <div role="status">
              <p>استان‌ها دریافت نشدند. دادهٔ جایگزین یا شهر پیش‌فرض نمایش داده نمی‌شود.</p>
              <button type="button" disabled={!enabled}
                onClick={() => setProvinceTry((n) => n + 1)}>
                تلاش دوباره برای استان‌ها
              </button>
            </div>
          )}
          {provinces.status === "ok" && provinces.items.length === 0 && (
            <p role="status">
              هنوز استانی در فهرست مرجعِ قابل انتخاب ثبت نشده است.
              شهر / منطقهٔ فروشگاه را دستی بنویسید.
            </p>
          )}
          {provinces.status === "ok" && provinces.items.length > 0 && (
            <>
              <label htmlFor="seller-ref-province">استان مرجع</label>
              <select id="seller-ref-province"
                value={selectedProvinceId}
                disabled={!enabled}
                aria-describedby="seller-location-reference-help"
                onChange={(event) => chooseProvince(event.target.value)}>
                <option value="">استان را انتخاب کنید</option>
                {provinces.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {province && (
                <>
                  {(!citiesReady && cities.status !== "unavailable") && (
                    <p role="status">در حال دریافت شهرهای مرجع…</p>
                  )}
                  {citiesFor === province.id &&
                    cities.status === "unavailable" && (
                    <div role="status">
                      <p>شهرهای مرجع این استان دریافت نشدند؛ به معنی نبود شهر یا نبود خدمت نیست.</p>
                      <button type="button" disabled={!enabled}
                        onClick={() => {
                          setSelectedCityId("");
                          setCitiesTry((n) => n + 1);
                        }}>
                        تلاش دوباره برای شهرها
                      </button>
                    </div>
                  )}
                  {citiesReady && cities.items.length === 0 && (
                    <p role="status">
                      فعلاً شهری برای این استان در فهرست مرجع قابل انتخاب نیست؛
                      متن شهر / منطقه را همچنان می‌توانید دستی بنویسید.
                    </p>
                  )}
                  {citiesReady && cities.items.length > 0 && (
                    <>
                      <label htmlFor="seller-ref-city">شهر مرجع</label>
                      <select id="seller-ref-city"
                        value={selectedCityId} disabled={!enabled}
                        aria-describedby="seller-location-reference-help"
                        onChange={(event) =>
                          setSelectedCityId(event.target.value)}>
                        <option value="">شهر را انتخاب کنید</option>
                        {cities.items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  {province && city && !candidate && (
                    <p role="status">
                      نام شهر و استان برای فیلد ۱۲۰ کاراکتری طولانی است؛
                      آن را به صورت دستی در فرم بنویسید.
                    </p>
                  )}
                  <button type="button"
                    className="seller-location-reference__apply"
                    disabled={!enabled || !candidate}
                    onClick={() => {
                      if (!enabled || !candidate) return;
                      onChoose(candidate);
                      setOpen(false);
                    }}>
                    نوشتن شهر و استان در فرم
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
