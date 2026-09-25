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
  | {
    status: "restored";
    revision: number;
    fields: SellerFields;
    applicantType: "NATURAL" | "LEGAL" | null;
    completedStep: number;
  }
  | {
    status: "submitted";
    revision: number;
    fields: SellerFields;
    applicantType: "NATURAL" | "LEGAL";
    completedStep: 6;
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
    // Older in-memory test doubles and pre-migration cached draft responses
    // map to step 1 only; the shipping BFF always emits both fields.
    const applicantType = "applicantType" in draft
      ? draft.applicantType : null;
    const completedStep = "completedStep" in draft
      ? draft.completedStep : 1;
    if ((applicantType !== null &&
        applicantType !== "NATURAL" && applicantType !== "LEGAL") ||
      typeof completedStep !== "number" ||
      !Number.isSafeInteger(completedStep) ||
      completedStep < 1 || completedStep > 6 ||
      (completedStep < 2 && applicantType !== null) ||
      (completedStep >= 2 && applicantType === null))
      return { status: "unavailable" };


    if (draft.status === "SUBMITTED") {
      if (!("submittedAtUtc" in draft) ||
        typeof draft.submittedAtUtc !== "string" ||
        Number.isNaN(Date.parse(draft.submittedAtUtc)))
        return { status: "unavailable" };
      return {
        status: "submitted",
        revision: draft.revision,
        fields,
        applicantType: applicantType as "NATURAL" | "LEGAL",
        completedStep: 6,
        submittedAtUtc: draft.submittedAtUtc,
      };
    }
    return {
      status: "restored",
      revision: draft.revision,
      fields,
      applicantType: applicantType as "NATURAL" | "LEGAL" | null,
      completedStep,
    };
  } catch {
    return { status: "unavailable" };
  }
}
