import { useEffect, useRef, useState } from "react";
import {
  Alert, BackHandler, Image, Pressable, ScrollView, StatusBar, StyleSheet, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";
import { buyerAuthPen } from "./buyer-auth-icons";

const logo = require("../assets/home-logo-badge.png");
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

type Props = { onBack: () => void };
const toPersianDigits = (value: string) => value.replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
const normalizeDigits = (value: string) => value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[^0-9]/g, "");

export function BuyerAuthScreen({ onBack }: Props) {
  const [phone, setPhone] = useState("۰۹۱۲۳۴۵۶۷۸۹");
  const [otp, setOtp] = useState(["۲", "۵", "۸", "", ""]);
  const [codeRequested, setCodeRequested] = useState(true);
  const phoneInput = useRef<TextInput>(null);
  const otpInputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const requestCode = () => {
    const digits = normalizeDigits(phone);
    if (!/^09\d{9}$/.test(digits)) {
      Alert.alert("شماره موبایل", "شماره موبایل را با ۱۱ رقم وارد کنید.");
      return;
    }
    setCodeRequested(true);
    Alert.alert("پیش‌نمایش ورود", "ارسال پیامک در این نسخه به سرویس احراز هویت متصل نیست.");
  };

  const updateOtp = (index: number, value: string) => {
    const digit = toPersianDigits(value.replace(/[^۰-۹0-9]/g, "").slice(-1));
    setOtp((current) => current.map((item, position) => position === index ? digit : item));
    if (digit && index < otpInputs.current.length - 1) otpInputs.current[index + 1]?.focus();
  };

  const confirmCode = () => {
    if (!codeRequested) return requestCode();
    if (otp.some((digit) => digit.length === 0)) {
      Alert.alert("کد تأیید", "کد ۵ رقمی را کامل کنید.");
      return;
    }
    Alert.alert("ورود آزمایشی", "احراز هویت و ورود واقعی هنوز به سرویس پیامک متصل نیست.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>ورود یا ثبت‌نام</Text>
        <Image source={logo} resizeMode="contain" style={styles.headerLogo} accessibilityLabel="حنا" />
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.welcome}>
          <View style={styles.logoTile}>
            <Image source={logo} resizeMode="contain" style={styles.welcomeLogo} accessibilityLabel="لوگوی حنا" />
          </View>
          <Text style={styles.welcomeTitle}>به بازار اجتماعی حنا خوش آمدید</Text>
          <Text style={styles.welcomeDescription}>برای خرید و مشارکت اجتماعی، وارد حساب کاربری خود شوید.</Text>
        </View>

        <View style={styles.phoneCard}>
          <Text style={styles.sectionTitle}>ورود با شماره موبایل</Text>
          <View style={styles.phoneFieldGroup}>
            <Text style={styles.fieldLabel}>شماره موبایل</Text>
            <TextInput
              ref={phoneInput}
              accessibilityLabel="شماره موبایل"
              value={phone}
              onChangeText={(value) => setPhone(toPersianDigits(value))}
              keyboardType="phone-pad"
              maxLength={11}
              editable
              selectTextOnFocus
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              placeholderTextColor="#8e8e93"
              style={styles.phoneInput}
              textAlign="right"
            />
            <Text style={styles.inputHint}>کد تأیید به این شماره پیامک خواهد شد.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="دریافت کد تأیید" onPress={requestCode} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>دریافت کد تأیید</Text>
          </Pressable>
        </View>

        <View style={styles.verifyCard}>
          <View style={styles.verifyHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="ویرایش شماره" onPress={() => phoneInput.current?.focus()} style={styles.editPhone}>
              <Text style={styles.editPhoneText}>ویرایش شماره</Text>
              <Image source={buyerAuthPen} style={styles.penIcon} accessibilityLabel="" />
            </Pressable>
            <Text style={styles.sectionTitle}>تأیید شماره موبایل</Text>
          </View>
          <Text style={styles.otpInstruction}>
            کد ۵ رقمی ارسال‌شده به شماره <Text style={styles.phoneEmphasis}>{phone}</Text> را وارد کنید:
          </Text>
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(element) => { otpInputs.current[index] = element; }}
                accessibilityLabel={`رقم ${index + 1} کد تأیید`}
                value={digit}
                onChangeText={(value) => updateOtp(index, value)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                textAlign="center"
                style={[styles.otpBox, digit ? styles.otpBoxFilled : styles.otpBoxEmpty, index === 3 && styles.otpBoxFocused]}
              />
            ))}
          </View>
          <View style={styles.resendRow}>
            <Text style={styles.timer}>ارسال مجدد کد تا ۰۱:۴۵</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="ارسال مجدد پیامک" disabled style={styles.resendDisabled}>
              <Text style={styles.resendText}>ارسال مجدد پیامک</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="تأیید و ورود به حنا" onPress={confirmCode} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>تأیید و ورود به حنا</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#f7f3ed" },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSpacer: { width: 40, height: 40 },
  headerTitle: { position: "absolute", left: 70, right: 70, color: "#2d2d2d", fontSize: 18, lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center" },
  headerLogo: { width: 80, height: 36 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48, gap: 28 },
  welcome: { width: "100%", alignItems: "center", paddingVertical: 16, gap: 12 },
  logoTile: { width: 80, height: 80, borderRadius: 24, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  welcomeLogo: { width: 60, height: 60 },
  welcomeTitle: { color: "#0f5b5a", fontSize: 20, lineHeight: 28, fontWeight: "800", ...rtl, textAlign: "center" },
  welcomeDescription: { color: "#8e8e93", fontSize: 13, lineHeight: 19, ...rtl, textAlign: "center" },
  phoneCard: { width: "100%", padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", gap: 20 },
  sectionTitle: { color: "#2d2d2d", fontSize: 15, lineHeight: 21, fontWeight: "700", ...rtl },
  phoneFieldGroup: { width: "100%", alignItems: "flex-end", gap: 6 },
  fieldLabel: { color: "#2d2d2d", fontSize: 13, lineHeight: 18, fontWeight: "600", ...rtl },
  phoneInput: { width: "100%", height: 48, paddingHorizontal: 16, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 12, backgroundColor: "#fff", color: "#2d2d2d", fontFamily: "Estedad400", fontSize: 14, writingDirection: "rtl" },
  inputHint: { width: "100%", color: "#8e8e93", fontSize: 11, lineHeight: 16, ...rtl },
  primaryButton: { width: "100%", height: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, borderRadius: 12, backgroundColor: "#b5523b" },
  primaryButtonText: { color: "#fff", fontSize: 15, lineHeight: 21, fontWeight: "800", ...rtl },
  verifyCard: { width: "100%", padding: 20, borderRadius: 16, borderWidth: 1.5, borderColor: "#0f5b5a", backgroundColor: "#fff", gap: 20, shadowColor: "#0f5b5a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  verifyHeader: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editPhone: { flexDirection: "row", alignItems: "center", gap: 8 },
  editPhoneText: { color: "#b5523b", fontSize: 12, lineHeight: 17, fontWeight: "700", ...rtl },
  penIcon: { width: 14, height: 14 },
  otpInstruction: { width: "100%", color: "#2d2d2d", fontSize: 13, lineHeight: 21, ...rtl },
  phoneEmphasis: { color: "#2d2d2d", fontWeight: "700", ...rtl },
  otpRow: { width: "100%", flexDirection: "row", direction: "ltr", alignItems: "center", justifyContent: "center", gap: 8 },
  otpBox: { width: 48, height: 48, padding: 0, borderWidth: 1.5, borderRadius: 10, fontFamily: "Estedad700", fontSize: 18, color: "#2d2d2d", writingDirection: "ltr" },
  otpBoxFilled: { backgroundColor: "#e8f2f2", borderColor: "#0f5b5a" },
  otpBoxEmpty: { backgroundColor: "#f7f3ed", borderColor: "#f0e7dd" },
  otpBoxFocused: { borderColor: "#0f5b5a" },
  resendRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timer: { color: "#8e8e93", fontSize: 12, lineHeight: 17, ...rtl },
  resendDisabled: { opacity: 0.5 },
  resendText: { color: "#8e8e93", fontSize: 12, lineHeight: 17, fontWeight: "700", ...rtl },
});
