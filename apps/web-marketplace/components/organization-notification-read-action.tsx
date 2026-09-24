"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OrganizationNotificationReadAction({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function markRead() {
    setPending(true);
    setError(false);
    try {
      const response = await fetch(
        "/api/organization/notifications/" + encodeURIComponent(id) + "/read",
        { method: "POST", cache: "no-store" },
      );
      if (!response.ok) throw new Error("read receipt failed");
      router.refresh();
    } catch { setError(true); }
    finally { setPending(false); }
  }

  return <span>
    <button type="button" className="org-button" disabled={pending}
      onClick={markRead}>
      {pending ? "در حال ثبت…" : "علامت‌گذاری به‌عنوان خوانده‌شده"}
    </button>
    {error ? <small role="alert">ثبت وضعیت انجام نشد؛ دوباره تلاش کنید.</small> : null}
  </span>;
}
