import { useEffect, useState } from "react";
import { Alert, BackHandler, Image, Pressable, ScrollView, StatusBar, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";
import { buyerAccountIcons } from "./buyer-account-icons";

const logo = require("../assets/home-logo-badge.png");
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const toPersianDigits = (value: string) => value.replace(/[0-9]/g, (digit) => faDigits[Number(digit)]);
const normalizeDigits = (value: string) => value.replace(/[۰-۹]/g, (digit) => String(faDigits.indexOf(digit))).replace(/[^0-9]/g, "");

type Props = { onBack: () => void };

export function BuyerCompleteProfileScreen({ onBack }: Props) {
  const [name, setName] = useState("کاربر نمونه");
  const [nationalId, setNationalId] = useState("");
  const [birthDate, setBirthDate] = useState("");

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const saveProfile = () => {
    const id = normalizeDigits(nationalId);
    if (id && id.length !== 10) {
      Alert.alert("کد ملی", "کد ملی باید ۱۰ رقم باشد.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("نام و نام خانوادگی", "نام و نام خانوادگی را وارد کنید.");
      return;
    }
    Alert.alert("پیش‌نمایش ذخیره", "اطلاعات در این نسخه آزمایشی به حساب کاربری ذخیره نمی‌شود.", [
      { text: "متوجه شدم", onPress: onBack },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به حساب کاربری" onPress={onBack} style={styles.backButton}>
          <Image source={buyerAccountIcons["chevron-right"]} style={styles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={styles.headerTitle}>تکمیل اطلاعات حساب</Text>
        <Image source={logo} resizeMode="contain" style={styles.headerLogo} accessibilityLabel="حنا" />
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardHeading}>مشخصات شخص حقیقی</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>نام و نام خانوادگی</Text>
            <TextInput
              accessibilityLabel="نام و نام خانوادگی"
              value={name}
              onChangeText={setName}
              placeholder="نام و نام خانوادگی"
              placeholderTextColor="#8e8e93"
              style={styles.input}
              textAlign="right"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>شماره موبایل</Text>
            <TextInput accessibilityLabel="شماره موبایل" value="۰۹۱۲۳۴۵۶۷۸۹" editable={false} style={styles.input} textAlign="right" />
            <Text style={styles.helper}>غیرقابل ویرایش</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>کد ملی (اختیاری)</Text>
            <TextInput
              accessibilityLabel="کد ملی اختیاری"
              value={nationalId}
              onChangeText={(value) => setNationalId(toPersianDigits(value.replace(/[^۰-۹0-9]/g, "").slice(0, 10)))}
              placeholder="مثال: ۰۰۱۲۳۴۵۶۷۸"
              placeholderTextColor="#8e8e93"
              keyboardType="number-pad"
              maxLength={10}
              style={styles.input}
              textAlign="right"
            />
            <Text style={styles.helper}>جهت استفاده از خدمات رسمی و اعتباری</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>تاریخ تولد (اختیاری)</Text>
            <TextInput
              accessibilityLabel="تاریخ تولد اختیاری"
              value={birthDate}
              onChangeText={(value) => setBirthDate(toPersianDigits(value))}
              placeholder="روز / ماه / سال"
              placeholderTextColor="#8e8e93"
              keyboardType="numbers-and-punctuation"
              style={styles.input}
              textAlign="right"
            />
            <Text style={styles.helper}>جهت فعال‌سازی خدمات ویژه سنی</Text>
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="ثبت و ذخیره اطلاعات" onPress={saveProfile} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>ثبت و ذخیره اطلاعات</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f3ed" },
  fill: { flex: 1 },
  header: { height: 56, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  backIcon: { width: 20, height: 20, transform: [{ rotate: "180deg" }] },
  headerTitle: { position: "absolute", left: 70, right: 110, color: "#2d2d2d", fontSize: 18, lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center" },
  headerLogo: { position: "absolute", right: 20, top: 10, zIndex: 5, width: 80, height: 36 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 20 },
  card: { width: "100%", padding: 18, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", gap: 16 },
  cardHeading: { width: "100%", color: "#0f5b5a", fontSize: 15, lineHeight: 26, fontWeight: "700", ...rtl },
  fieldGroup: { width: "100%", alignItems: "flex-end", gap: 6 },
  label: { color: "#2d2d2d", fontSize: 13, lineHeight: 23, fontWeight: "600", ...rtl },
  input: { width: "100%", height: 48, paddingHorizontal: 16, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 12, backgroundColor: "#fff", color: "#2d2d2d", fontFamily: "Estedad400", fontSize: 14, writingDirection: "rtl" },
  helper: { width: "100%", color: "#8e8e93", fontSize: 11, lineHeight: 19, ...rtl },
  saveButton: { width: "100%", height: 54, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, borderRadius: 12, backgroundColor: "#b5523b" },
  saveButtonText: { color: "#fff", fontSize: 15, lineHeight: 21, fontWeight: "800", ...rtl },
});
