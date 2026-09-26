"use client";

import { useEffect, useState } from "react";

type Role = "ORG_LEAD" | "ORG_REPRESENTATIVE" | "ORG_TECHNICAL_OPERATOR";
type Profile = { organizationId: string; organizationName: string; memberRole: Role; membershipId: string };
const roleLabels: Record<Role, string> = {
  ORG_LEAD: "مدیر سازمان",
  ORG_REPRESENTATIVE: "نماینده سازمان",
  ORG_TECHNICAL_OPERATOR: "اپراتور فنی پروژه",
};

export function OrganizationProfile() {
  const [state, setState] = useState<{ loading: boolean; profiles: Profile[]; message?: string }>({ loading: true, profiles: [] });
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/organization/profiles", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || !body || typeof body !== "object") {
          setState({ loading: false, profiles: [], message: body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "اطلاعات سازمان در دسترس نیست." });
          return;
        }
        setState({ loading: false, profiles: (body as { profiles: Profile[] }).profiles });
      }).catch(() => { if (!controller.signal.aborted) setState({ loading: false, profiles: [], message: "ارتباط با سرویس سازمان برقرار نشد." }); });
    return () => controller.abort();
  }, []);

  return (
    <main className="organization-page" dir="rtl">
      <header className="organization-header"><span>پرتال سازمان</span><h1>اطلاعات و پروفایل سازمان</h1></header>
      <section className="organization-content" aria-live="polite">
        {state.loading ? <p role="status">در حال بررسی عضویت سازمانی…</p> : state.message ? <div className="organization-notice">{state.message}</div> : state.profiles.length === 0 ? <div className="organization-notice">برای این حساب، پروفایل سازمانی در دسترس نیست.</div> : state.profiles.map((profile) => (
          <article className="organization-card" key={profile.membershipId}>
            <div className="organization-card-title"><h2>{profile.organizationName}</h2><span>{roleLabels[profile.memberRole]}</span></div>
            <div className="organization-divider" />
            <dl className="organization-fields">
              <div><dt>عنوان سازمان</dt><dd>{profile.organizationName}</dd></div>
              <div><dt>نقش دسترسی</dt><dd>{roleLabels[profile.memberRole]}</dd></div>
              <div><dt>اطلاعات تماس، نماینده و شناسه‌های سازمان</dt><dd>در این برش هنوز ثبت نشده است.</dd></div>
            </dl>
          </article>
        ))}
      </section>
    </main>
  );
}
