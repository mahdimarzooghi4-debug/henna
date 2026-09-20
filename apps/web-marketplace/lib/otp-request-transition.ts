/**
 * Requesting a second OTP has different safety semantics than the first.
 * A new acknowledged challenge replaces the old one, throttling preserves
 * the old entry attempt, and an unknown send outcome makes the old challenge
 * untrustworthy (the issuer may already have invalidated it).
 *
 * This models UI recovery only: 202 acknowledges an issuance request; it
 * does not prove SMS delivery, OTP verification, or an authenticated session.
 */
export type OtpRequestOutcome =
  | { status: "accepted"; challengeId: string }
  | { status: "invalid" | "limited" | "unavailable" };

export type OtpRequestTransition = {
  stage: "phone" | "code";
  challengeId: string;
  code: string;
  status: "idle" | "invalid" | "limited" | "unavailable";
  message: string;
};

export function otpRequestTransition(
  outcome: OtpRequestOutcome,
  previous: { challengeId: string; code: string },
  resend: boolean,
): OtpRequestTransition {
  if (outcome.status === "accepted") {
    return {
      stage: "code", challengeId: outcome.challengeId,
      code: "", status: "idle",
      message: resend
        ? "درخواست کد جدید پذیرفته شد. کد قبلی دیگر معتبر نیست؛ فقط کد جدید را وارد کنید."
        : "",
    };
  }
  if (outcome.status === "limited") {
    return {
      stage: resend ? "code" : "phone",
      challengeId: resend ? previous.challengeId : "",
      code: resend ? previous.code : "",
      status: "limited",
      message: resend
        ? "درخواست مجدد زود است. اگر کد قبلی را دارید و هنوز اعتبار دارد، می‌توانید آن را امتحان کنید؛ در غیر این صورت بعداً کد تازه بخواهید."
        : "تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.",
    };
  }
  return {
    stage: "phone", challengeId: "", code: "",
    status: outcome.status,
    message: resend
      ? "وضعیت درخواست کد جدید مشخص نیست؛ کد قبلی ممکن است باطل شده باشد. برای جلوگیری از ورود با کد نامطمئن، بعداً دوباره کد بخواهید."
      : outcome.status === "invalid"
        ? "شماره موبایل معتبر نیست."
        : "خدمت ارسال کد تأیید در دسترس نیست؛ پذیرش درخواست تأیید نشد.",
  };
}
