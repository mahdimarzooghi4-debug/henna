/**
 * This small React Native state policy mirrors the web auth recovery logic.
 * Keep the Expo bundle self-contained: Metro must not import Next.js files.
 * A provider timeout after requesting a second code may invalidate the first.
 */
export type OtpRequestOutcome =
  | { status: "accepted"; challengeId: string }
  | { status: "invalid" | "limited" | "unavailable" };

export type MobileOtpRequestTransition = {
  view: "phone" | "code";
  challengeId: string | null;
  code: string;
  status: "idle" | "invalid" | "limited" | "unavailable";
  notice: string;
};

export function otpRequestTransition(
  outcome: OtpRequestOutcome,
  previous: { challengeId: string | null; code: string },
  resend: boolean,
): MobileOtpRequestTransition {
  if (outcome.status === "accepted") {
    return {
      view: "code", challengeId: outcome.challengeId,
      code: "", status: "idle",
      notice: resend
        ? "درخواست کد تازه پذیرفته شد. کد قبلی دیگر معتبر نیست؛ فقط کد جدید را وارد کنید."
        : "",
    };
  }
  if (outcome.status === "limited") {
    return {
      view: resend ? "code" : "phone",
      challengeId: resend ? previous.challengeId : null,
      code: resend ? previous.code : "",
      status: "limited",
      notice: resend
        ? "درخواست دوباره زود است؛ اگر کد قبلی را دارید و هنوز معتبر است، می‌توانید آن را وارد کنید. بعداً هم می‌توانید کد تازه بخواهید."
        : "",
    };
  }
  return {
    view: "phone", challengeId: null, code: "",
    status: outcome.status,
    notice: resend
      ? "وضعیت درخواست جدید روشن نیست؛ کد قبلی ممکن است باطل شده باشد. بعداً کد جدید بخواهید."
      : "",
  };
}
