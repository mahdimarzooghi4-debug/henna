/**
 * Browser-side validation is independent of the Next gateway's validation:
 * a malformed or unavailable response cannot be treated as "no draft".
 */
export type SellerFields = {
  storeName: string;
  ownerName: string;
  phone: string;
  city: string;
  address: string;
  postalCode: string;
};

export const emptySellerFields: SellerFields = {
  storeName: "", ownerName: "", phone: "",
  city: "", address: "", postalCode: "",
};

export const sellerFieldKeys = Object.keys(emptySellerFields) as (keyof SellerFields)[];

export type SellerPreflight =
  | { status: "signedOut" }
  | { status: "unavailable" }
  | { status: "new"; revision: 0 }
  | { status: "restored"; revision: number; fields: SellerFields }
  | {
    status: "submitted";
    revision: number;
    fields: SellerFields;
    submittedAtUtc: string;
  };

export async function loadSellerDraft(
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SellerPreflight> {
  try {
    const response = await fetchFn("/api/seller/registration", {
      cache: "no-store", signal,
    });
    if (response.status === 401) return { status: "signedOut" };
    if (response.status === 404) return { status: "new", revision: 0 };
    if (response.status !== 200) return { status: "unavailable" };

    const draft: unknown = await response.json();
    if (!draft || typeof draft !== "object" ||
      !("status" in draft) ||
      (draft.status !== "DRAFT" && draft.status !== "SUBMITTED") ||
      !("revision" in draft) || typeof draft.revision !== "number" ||
      !Number.isSafeInteger(draft.revision) ||
      draft.revision < 1 || draft.revision >= 2147483647)
      return { status: "unavailable" };

    const values = draft as Record<string, unknown>;
    if (!sellerFieldKeys.every((key) => typeof values[key] === "string"))
      return { status: "unavailable" };

    const fields = Object.fromEntries(sellerFieldKeys.map((key) =>
      [key, values[key]])) as SellerFields;
    if (draft.status === "SUBMITTED") {
      if (!("submittedAtUtc" in draft) ||
        typeof draft.submittedAtUtc !== "string" ||
        Number.isNaN(Date.parse(draft.submittedAtUtc)))
        return { status: "unavailable" };
      return {
        status: "submitted",
        revision: draft.revision,
        fields,
        submittedAtUtc: draft.submittedAtUtc,
      };
    }
    return { status: "restored", revision: draft.revision, fields };
  } catch {
    return { status: "unavailable" };
  }
}
