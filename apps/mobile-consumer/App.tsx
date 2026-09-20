import { useState } from "react";
import {
  Alert,
  Image,
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
import { isValidIranianMobile, normalizeIranianMobile } from "./src/phone";

type FormStatus = "idle" | "invalid" | "loading" | "unavailable" | "limited" | "sent";

const logo = require("./assets/hana-app-logo.png");
const backIcon = require("./assets/back.png");

function ConsumerAuthScreen() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  async function requestCode() {
    if (status === "loading") return;

    const normalized = normalizeIranianMobile(phone);
    setPhone(normalized);
    if (!isValidIranianMobile(normalized)) {
      setStatus("invalid");
      return;
    }

    // EXPO_PUBLIC_* holds ONLY a public API URL, NEVER an SMS provider secret.
    const apiBase = process.env.EXPO_PUBLIC_HANA_API_BASE_URL?.trim();
    if (!apiBase || (!__DEV__ && !apiBase.startsWith("https://"))) {
      setStatus("unavailable");
      return;
    }

    setStatus("loading");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `${apiBase.replace(/\/$/, "")}/api/v1/auth/otp/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalized }),
          signal: controller.signal,
        },
      );
      setStatus(
        response.status === 202
          ? "sent"
          : response.status === 400
            ? "invalid"
            : response.status === 429
              ? "limited"
              : "unavailable",
      );
    } catch {
      setStatus("unavailable");
    } finally {
      clearTimeout(timeout);
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
              onPress={() =>
                Alert.alert(
                  "فروشگاه حنا",
                  "صفحه اصلی اپ مصرف‌کننده هنوز در این مرحله ساخته نشده است."
                )
              }
            >
              <Image source={backIcon} style={styles.backIcon} resizeMode="contain" />
            </Pressable>
          </View>

          <View style={styles.intro}>
            <Text style={styles.title}>ورود به حنا</Text>
            <Text style={styles.subtitle}>
              با شماره موبایل وارد شوید یا ثبت‌نام کنید.
            </Text>
          </View>

          <View style={styles.card}>
            <Text nativeID="mobile-phone-label" style={styles.fieldLabel}>
              شماره موبایل
            </Text>
            <TextInput
              accessibilityLabel="شماره موبایل"
              style={[styles.input, status === "invalid" && styles.invalidInput]}
              placeholder="09xxxxxxxxx"
              placeholderTextColor={colors.muted}
              textAlign="right"
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={11}
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setStatus("idle");
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
              onPress={requestCode}
              disabled={status === "loading"}
            >
              <Text style={styles.primaryButtonText}>
                {status === "loading" ? "در حال بررسی…" : "دریافت کد تأیید"}
              </Text>
            </Pressable>

            {status !== "idle" && status !== "loading" && (
              <Text
                accessibilityRole={status === "invalid" ? "alert" : "text"}
                style={[
                  styles.formStatus,
                  status === "invalid" && styles.formStatusError,
                ]}
              >
                {status === "invalid"
                  ? "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد."
                  : status === "limited"
                    ? "تعداد درخواست‌ها زیاد است. لطفاً کمی بعد تلاش کنید."
                    : status === "sent"
                      ? "درخواست ارسال پذیرفته شد. مرحله واردکردن کد هنوز آماده نیست."
                      : "سرویس ارسال کد در دسترس نیست؛ کدی ارسال نشد."}
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
                    "ثبت‌نام فروشگاه فقط در نسخه وب حنا ارائه می‌شود. صفحه وب این بخش ساخته شده اما هنوز به بک‌اند متصل نیست."
                  )
                }
              >
                <Text style={styles.sellerLink}>ثبت‌نام فروشگاه</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ConsumerAuthScreen />
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
});
