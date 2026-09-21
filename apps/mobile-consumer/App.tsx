import { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import {
  Alert,
  AppState,
  Image,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { colors, space } from "./src/theme";
import { BuyerBrowseScreen } from "./src/buyer-browse-screen";
import {
  parseBuyerLink, type BuyerLinkEvent, type BuyerLinkRoute,
} from "./src/buyer-link";
import { isValidIranianMobile, normalizeIranianMobile, normalizeDigits } from "./src/phone";
import { MobileAuthClient } from "./src/mobile-auth";
import { otpRequestTransition } from "./src/otp-request-transition";
import { validateOtpEntry } from "./src/otp-form-input";
import {
  shouldRecheckOnForeground, type MobileAuthView,
} from "./src/session-foreground";

type FormStatus = "idle" | "invalid" | "loading" | "unavailable" | "limited";
type ViewState = MobileAuthView;

const logo = require("./assets/hana-app-logo.png");
const backIcon = require("./assets/back.png");
const tokenKey = "hana.consumer.session.v1";
const secureOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Expo SecureStore uses iOS Keychain / Android Keystore-backed encrypted storage.
// Keep the bearer OUT of React state, console, AsyncStorage and Expo public config.
const auth = new MobileAuthClient(
  process.env.EXPO_PUBLIC_HANA_API_BASE_URL,
  {
    read: () => SecureStore.getItemAsync(tokenKey, secureOptions),
    write: (token) => SecureStore.setItemAsync(tokenKey, token, secureOptions),
    remove: () => SecureStore.deleteItemAsync(tokenKey, secureOptions),
  },
  fetch,
  Date.now,
  __DEV__,
);

function ConsumerAuthScreen({ onBrowse }: { onBrowse: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>("checking");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [resendNotice, setResendNotice] = useState("");
  const [codeError, setCodeError] = useState("");
  const phoneInput = useRef<TextInput>(null);
  const codeInput = useRef<TextInput>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const viewRef = useRef<ViewState>("checking");
  const appState = useRef(AppState.currentState);

  async function refreshSession() {
    if (pending.current) return;
    pending.current = true;
    setStatus("loading");
    setView("checking");
    try {
      const result = await auth.session();
      if (!mounted.current) return;
      if (result.status === "guest") {
        // After remote revocation/expiry, remove the last phone and OTP
        // from React memory; SecureStore deletion is done by auth.session.
        setPhone("");
        setCode("");
        setChallengeId(null);
        setResendNotice("");
        setCodeError("");
      }
      setView(result.status === "authenticated" ? "session"
        : result.status === "guest" ? "phone" : "offline");
      setStatus(result.status === "unavailable" ? "unavailable" : "idle");
    } finally {
      pending.current = false;
    }
  }

  useEffect(() => {
    mounted.current = true;
    void refreshSession();
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previous = appState.current;
      appState.current = nextState;
      if (!mounted.current ||
        !shouldRecheckOnForeground(
          previous, nextState, viewRef.current, pending.current,
        )) return;
      // Hide an unverified old session immediately on return. The native
      // transport handles 401 vs network failure and SecureStore integrity.
      void refreshSession();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Focus the actual step only once it is mounted. An acknowledged resend
    // changes challengeId while remaining in "code", so it also refocuses
    // the cleared six-digit field. A throttled resend changes neither.
    if (view === "phone") phoneInput.current?.focus();
    if (view === "code") codeInput.current?.focus();
  }, [view, challengeId]);

  async function requestCode(resend = false) {
    if (pending.current ||
      (resend && (view !== "code" || !challengeId)) ||
      (!resend && view !== "phone")) return;
    const normalized = normalizeIranianMobile(phone);
    if (!isValidIranianMobile(normalized)) {
      if (resend) {
        setChallengeId(null);
        setCode("");
        setView("phone");
      }
      setStatus("invalid");
      return;
    }
    const previous = { challengeId, code };
    setCodeError("");
    setPhone(normalized);
    pending.current = true;
    setStatus("loading");
    setResendNotice("");
    try {
      const result = await auth.requestOtp(normalized);
      if (!mounted.current) return;
      const next = otpRequestTransition(result, previous, resend);
      setChallengeId(next.challengeId);
      setCode(next.code);
      setView(next.view);
      setStatus(next.status);
      setResendNotice(next.notice);
    } finally {
      pending.current = false;
    }
  }

  async function verifyCode() {
    if (pending.current || view !== "code" || !challengeId) return;
    const checked = validateOtpEntry(code);
    setCode(checked.code);
    if (checked.error) {
      setStatus("invalid");
      setCodeError(checked.error);
      return;
    }
    setCodeError("");
    pending.current = true;
    setStatus("loading");
    try {
      const result = await auth.verifyOtp(phone, challengeId, checked.code);
      if (!mounted.current) return;
      if (result.status === "authenticated") {
        setPhone("");
        setCode("");
        setChallengeId(null);
        setView("session");
        setStatus("idle");
        setResendNotice("");
        setCodeError("");
      } else {
        setStatus(result.status);
      }
    } finally {
      pending.current = false;
    }
  }

  async function logout() {
    if (pending.current) return;
    pending.current = true;
    setStatus("loading");
    try {
      const result = await auth.logout();
      if (!mounted.current) return;
      if (result.status === "signedOut") {
        setView("phone");
        setPhone("");
        setCode("");
        setChallengeId(null);
        setStatus("idle");
        setResendNotice("");
        setCodeError("");
      } else {
        // An outage is not proof of server-side revocation: retain SecureStore.
        setStatus("unavailable");
      }
    } finally {
      pending.current = false;
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Image
              source={logo}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="حنا"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="بازگشت به فروشگاه"
              style={styles.backTouch}
              onPress={onBrowse}
            >
              <Image source={backIcon} style={styles.backIcon} resizeMode="contain" />
            </Pressable>
          </View>

          <View style={styles.intro}>
            <Text style={styles.title}>ورود به حنا</Text>
            <Text style={styles.subtitle}>
              {view === "session"
                ? "نشست شما در سرور حنا بررسی شده است."
                : "با شماره موبایل وارد شوید یا ثبت‌نام کنید."}
            </Text>
          </View>

          <View style={styles.card}>
            {view === "phone" && (
              <>
                <Text nativeID="mobile-phone-label" style={styles.fieldLabel}>
                  شماره موبایل
                </Text>
                <TextInput
                  ref={phoneInput}
                  accessibilityLabel="شماره موبایل"
                  accessibilityHint={status === "invalid"
                    ? "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد."
                    : undefined}
                  accessibilityState={{ disabled: status === "loading" }}
                  editable={status !== "loading"}
                  style={[styles.input, status === "invalid" && styles.invalidInput]}
                  placeholder="09xxxxxxxxx"
                  placeholderTextColor={colors.muted}
                  textAlign="right"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={11}
                  value={phone}
                  onChangeText={(value) => {
                    if (pending.current) return;
                    setPhone(value);
                    setStatus("idle");
                    setResendNotice("");
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="دریافت کد تأیید"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    status === "loading" && styles.primaryButtonLoading,
                  ]}
                  onPress={() => void requestCode(false)}
                  disabled={status === "loading"}
                >
                  <Text style={styles.primaryButtonText}>
                    {status === "loading" ? "در حال بررسی…" : "دریافت کد تأیید"}
                  </Text>
                </Pressable>
                {status !== "idle" && status !== "loading" && (
                  <Text accessibilityRole="alert" style={[
                    styles.formStatus, status === "invalid" && styles.formStatusError,
                  ]}>
                    {resendNotice || (status === "invalid"
                      ? "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد."
                      : status === "limited"
                        ? "تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید."
                        : "سرویس ارسال کد در دسترس نیست؛ دریافت کد تأیید نشده است.")}
                  </Text>
                )}

                <View style={styles.note}>
                  <Text style={styles.noteTitle}>یک حساب؛ چند امکان</Text>
                  <Text style={styles.noteBody}>
                    پس از ورود، حساب حقیقی یا حقوقی تکمیل می‌شود.
                  </Text>
                </View>
                <View style={styles.footer}>
                  <Text style={styles.footerLabel}>فروشگاه دارید؟</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="ثبت‌نام فروشگاه"
                    onPress={() =>
                      Alert.alert(
                        "ثبت‌نام فروشگاه",
                        "ثبت‌نام فروشگاه فقط در نسخه وب حنا ارائه می‌شود. فرم اولیه وب به API و پایگاه داده متصل است؛ اما ورود عمومی با پیامک و تأیید نهایی فروشگاه هنوز فعال نیست."
                      )
                    }
                  >
                    <Text style={styles.sellerLink}>ثبت‌نام فروشگاه</Text>
                  </Pressable>
                </View>
              </>
            )}

            {view === "code" && (
              <>
                {/* Technical OTP step only: its final visual frame needs approved Figma. */}
                <Text style={styles.fieldLabel}>کد تأیید برای {phone}</Text>
                <TextInput
                  ref={codeInput}
                  accessibilityLabel="کد شش رقمی تأیید"
                  accessibilityHint={status === "invalid"
                    ? codeError || "کد یا اطلاعات تأیید معتبر نیست."
                    : undefined}
                  accessibilityState={{ disabled: status === "loading" }}
                  editable={status !== "loading"}
                  style={[styles.input, status === "invalid" && styles.invalidInput]}
                  placeholder="xxxxxx"
                  placeholderTextColor={colors.muted}
                  textAlign="right"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={(value) => {
                    if (pending.current) return;
                    setCode(normalizeDigits(value));
                    setCodeError("");
                    setStatus("idle");
                    setResendNotice("");
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="تأیید کد"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    status === "loading" && styles.primaryButtonLoading,
                  ]}
                  onPress={verifyCode}
                  disabled={status === "loading"}
                >
                  <Text style={styles.primaryButtonText}>
                    {status === "loading" ? "در حال تأیید…" : "تأیید کد"}
                  </Text>
                </Pressable>
                {status !== "idle" && status !== "loading" && (
                  <Text accessibilityRole="alert" style={[
                    styles.formStatus, status === "invalid" && styles.formStatusError,
                  ]}>
                    {resendNotice || (status === "invalid"
                      ? codeError || "کد یا اطلاعات تأیید معتبر نیست."
                      : status === "limited"
                        ? "تعداد تلاش‌ها زیاد است؛ بعداً دوباره تلاش کنید."
                        : "تأیید کد در دسترس نیست؛ ورود انجام نشد.")}
                  </Text>
                )}
                {resendNotice && status === "idle" && (
                  <Text accessibilityRole="alert" style={styles.formStatus}>
                    {resendNotice}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="درخواست کد تأیید جدید"
                  onPress={() => void requestCode(true)}
                  disabled={status === "loading"}
                >
                  <Text style={[styles.sellerLink, styles.secondaryLink]}>
                    درخواست کد جدید
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="ویرایش شماره موبایل"
                  disabled={status === "loading"}
                  onPress={() => {
                    if (pending.current) return;
                    setChallengeId(null);
                    setCode("");
                    setStatus("idle");
                    setResendNotice("");
                    setCodeError("");
                    setView("phone");
                  }}
                >
                  <Text style={[styles.sellerLink, styles.secondaryLink]}>
                    ویرایش شماره موبایل
                  </Text>
                </Pressable>
              </>
            )}

            {view === "checking" && (
              <Text style={styles.formStatus}>در حال بررسی نشست در سرور…</Text>
            )}
            {view === "offline" && (
              <>
                <Text style={styles.formStatus}>
                  بررسی نشست ممکن نیست؛ اطلاعات امن دستگاه پاک نشده است.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="تلاش مجدد بررسی نشست"
                  style={styles.primaryButton}
                  onPress={refreshSession}
                >
                  <Text style={styles.primaryButtonText}>تلاش مجدد</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="خروج از نشست موجود"
                  onPress={logout}
                  disabled={status === "loading"}
                >
                  <Text style={[styles.sellerLink, styles.secondaryLink]}>خروج</Text>
                </Pressable>
              </>
            )}
            {view === "session" && (
              <>
                <Text style={styles.fieldLabel}>نشست شما فعال است.</Text>
                <Text style={styles.formStatus}>
                  اعتبار نشست از API حنا استعلام شده است. مرور کاتالوگ برای همه در صفحهٔ اصلی در دسترس است.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="بررسی دوباره اعتبار نشست"
                  disabled={status === "loading"}
                  onPress={() => void refreshSession()}
                >
                  <Text style={[styles.sellerLink, styles.secondaryLink]}>
                    بررسی دوباره اعتبار نشست
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="خروج از حساب"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    status === "loading" && styles.primaryButtonLoading,
                  ]}
                  onPress={logout}
                  disabled={status === "loading"}
                >
                  <Text style={styles.primaryButtonText}>
                    {status === "loading" ? "در حال خروج…" : "خروج از حساب"}
                  </Text>
                </Pressable>
                {status === "unavailable" && (
                  <Text accessibilityRole="alert" style={styles.formStatus}>
                    خروج کامل نشد؛ نشست دستگاه تا تأیید و پاک‌سازی حفظ شده است.
                  </Text>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const blankBrowseLink: BuyerLinkRoute = {
  kind: "browse", browse: { categoryId: null, search: "", page: 1 },
};

export default function App() {
  const [screen, setScreen] = useState<"browse" | "auth">("browse");
  // Defer starting public HTTP until getInitialURL settles. A cold detail
  // link must not first fetch page 1 and briefly paint unrelated content.
  const [link, setLink] = useState<BuyerLinkEvent | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    let active = true;
    let receivedLiveLink = false;
    const apply = (url: string | null, incoming: boolean) => {
      const route = parseBuyerLink(url);
      if (incoming && route === null) return; // Never navigate on untrusted URL.
      setLink({ token: ++sequence.current, route: route ?? blankBrowseLink });
      if (incoming) setScreen("browse");
    };
    const listener = Linking.addEventListener("url", ({ url }) => {
      if (!active || parseBuyerLink(url) === null) return;
      receivedLiveLink = true;
      apply(url, true);
    });
    void Linking.getInitialURL()
      .then((url) => {
        if (active && !receivedLiveLink) apply(url, false);
      })
      .catch(() => {
        if (active && !receivedLiveLink) apply(null, false);
      });
    return () => { active = false; listener.remove(); };
  }, []);

  return (
    <SafeAreaProvider>
      {link === null ? <View style={styles.flex} /> :
        screen === "browse"
          ? <BuyerBrowseScreen link={link}
              onLogin={() => setScreen("auth")} />
          : <ConsumerAuthScreen onBrowse={() => setScreen("browse")} />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.cream },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.normal,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { width: 82, height: 38 },
  backTouch: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: { width: 32, height: 32 },
  intro: { marginTop: 28, paddingHorizontal: space.sm },
  title: {
    color: colors.charcoal,
    fontWeight: "700",
    fontSize: 30,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    marginTop: 0,
    color: colors.muted,
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.beige,
    borderRadius: 18,
    marginTop: 26,
    paddingHorizontal: 17,
    paddingVertical: 20,
    minHeight: 398,
  },
  fieldLabel: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 28,
  },
  input: {
    marginTop: 4,
    height: 54,
    borderWidth: 1,
    borderColor: colors.beige,
    borderRadius: 11,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.charcoal,
  },
  invalidInput: { borderColor: colors.terracotta },
  primaryButton: {
    height: 54,
    backgroundColor: colors.terracotta,
    marginTop: 26,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonPressed: { opacity: 0.84 },
  primaryButtonLoading: { opacity: 0.6 },
  primaryButtonText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
  formStatus: {
    backgroundColor: colors.paleTeal,
    color: colors.teal,
    fontSize: 13,
    textAlign: "right",
    padding: 10,
    borderRadius: 10,
    lineHeight: 22,
    marginTop: 12,
  },
  formStatusError: {
    backgroundColor: colors.errorSurface,
    color: colors.error,
  },
  note: {
    minHeight: 96,
    marginTop: 28,
    borderRadius: 12,
    backgroundColor: colors.paleTeal,
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: "center",
  },
  noteTitle: {
    color: colors.teal,
    fontWeight: "700",
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 28,
  },
  noteBody: {
    color: colors.charcoal,
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 28,
  },
  footer: { marginTop: 16 },
  footerLabel: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 27,
  },
  sellerLink: {
    color: colors.terracotta,
    fontWeight: "700",
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 28,
  },
  secondaryLink: { marginTop: 22, textAlign: "center" },
});
