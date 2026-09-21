import { useEffect, useState } from "react";
import {
  BackHandler, Image, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BuyerDetailController, type BuyerDetailState } from "./buyer-detail-controller.ts";
import { MobileCatalogClient } from "./mobile-catalog.ts";
import { colors } from "./theme";

const logo = require("../assets/hana-app-logo.png");
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

/** Owner-approved Figma 480:3/480:5/480:7 — real public detail only. */
export function BuyerProductDetailScreen({
  id, catalog, onBack,
}: { id: string; catalog: MobileCatalogClient; onBack: () => void }) {
  const [state, setState] = useState<BuyerDetailState>({ status: "loading", id });
  const [controller] = useState(
    () => new BuyerDetailController(catalog, setState, id),
  );

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress", () => { onBack(); return true; },
    );
    return () => subscription.remove();
  }, [onBack]);

  const detail: BuyerDetailState = state.id === id
    ? state : { status: "loading", id };
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <ScrollView contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain"
            accessibilityLabel="حنا" />
          <Pressable onPress={onBack} accessibilityRole="button"
            accessibilityLabel="بازگشت به فهرست"
            style={styles.headerBack}>
            <Text style={styles.headerBackText}>بازگشت</Text>
          </Pressable>
        </View>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>جزئیات کاتالوگ عمومی حنا</Text>
          <Text style={styles.title} accessibilityRole="header">
            جزئیات کالا یا خدمت
          </Text>
          <Text style={styles.subtitle}>
            فقط اطلاعات منتشرشده از API حنا؛ خرید در این مرحله فعال نیست.
          </Text>

          {detail.status === "loading" ? (
            <View style={styles.card}>
              <Text accessibilityLiveRegion="polite" style={styles.text}>
                در حال دریافت جزئیات…
              </Text>
            </View>
          ) : detail.status === "missing" ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                این کالا یا خدمت پیدا نشد
              </Text>
              <Text style={styles.text}>
                این شناسه در کاتالوگ منتشرشدهٔ حنا قابل مشاهده نیست.
              </Text>
            </View>
          ) : detail.status === "unavailable" ? (
            <>
              <View style={styles.card}>
                <Text style={[styles.cardTitle, styles.error]}
                  accessibilityRole="header">
                  دریافت جزئیات تأیید نشد
                </Text>
                <Text style={styles.text} accessibilityRole="alert">
                  قطع ارتباط یا پاسخ نامعتبر به معنای نبود کالا نیست؛ دوباره تلاش کنید.
                </Text>
              </View>
              <Pressable accessibilityRole="button"
                accessibilityLabel="تلاش دوباره برای دریافت جزئیات"
                onPress={() => void controller.refresh()}
                style={styles.primaryButton}>
                <Text style={styles.primaryText}>
                  تلاش دوباره برای دریافت جزئیات
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardEyebrow}>
                  محتوای منتشرشدهٔ کاتالوگ
                </Text>
                <Text style={styles.cardTitle} accessibilityRole="header">
                  {detail.product.name}
                </Text>
                <Text style={styles.text}>
                  نوع: {detail.product.kind === "SERVICE" ? "خدمت" : "کالا"}
                </Text>
                <Text style={styles.category} selectable>
                  شناسهٔ دسته‌بندی: {detail.product.categoryId}
                </Text>
                {detail.product.description !== null ? (
                  <Text style={styles.description}>
                    {detail.product.description}
                  </Text>
                ) : null}
              </View>
              <View style={styles.disclosure}>
                <Text style={styles.disclosureText}>
                  قیمت، موجودی، تصویر، فروشنده، شهر و دکمهٔ خرید هنوز در قرارداد عمومی وجود ندارند.
                </Text>
              </View>
            </>
          )}

          <Pressable onPress={onBack} accessibilityRole="button"
            accessibilityLabel="بازگشت به فهرست کالاها"
            style={styles.backButton}>
            <Text style={styles.backText}>بازگشت به فهرست کالاها</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  scrollBody: { flexGrow: 1, backgroundColor: colors.surface },
  header: {
    height: 80, paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", backgroundColor: colors.surface,
  },
  logo: { width: 145, height: 48 },
  headerBack: {
    minHeight: 44, minWidth: 64, justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerBackText: { color: colors.teal, fontWeight: "700", fontSize: 14, ...rtl },
  content: {
    width: "100%", maxWidth: 560, alignSelf: "center",
    paddingHorizontal: 20, paddingTop: 25, paddingBottom: 60, gap: 14,
  },
  eyebrow: { color: colors.terracotta, fontSize: 12, fontWeight: "700", ...rtl },
  title: {
    color: colors.charcoal, fontSize: 24, fontWeight: "700",
    lineHeight: 38, ...rtl,
  },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 24, ...rtl },
  card: {
    minHeight: 190, borderWidth: 1, borderColor: colors.beige,
    backgroundColor: colors.surface, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 17, gap: 10,
  },
  cardTitle: {
    color: colors.teal, fontSize: 19, fontWeight: "700",
    lineHeight: 32, ...rtl,
  },
  error: { color: colors.error },
  cardEyebrow: {
    color: colors.terracotta, fontSize: 12, fontWeight: "700", ...rtl,
  },
  text: { color: colors.muted, fontSize: 14, lineHeight: 26, ...rtl },
  category: { color: colors.muted, fontSize: 13, lineHeight: 24, ...rtl },
  description: { color: colors.muted, fontSize: 14, lineHeight: 26, ...rtl },
  disclosure: {
    backgroundColor: colors.paleTeal, borderRadius: 12,
    paddingHorizontal: 15, paddingVertical: 13,
  },
  disclosureText: { color: colors.teal, fontSize: 13, lineHeight: 25, ...rtl },
  primaryButton: {
    backgroundColor: colors.teal, minHeight: 54, borderRadius: 12,
    justifyContent: "center", paddingHorizontal: 15, paddingVertical: 10,
  },
  primaryText: {
    color: colors.surface, fontSize: 14, fontWeight: "700", ...rtl,
  },
  backButton: {
    borderWidth: 1, borderColor: colors.teal, borderRadius: 12,
    minHeight: 54, justifyContent: "center", paddingHorizontal: 15,
    paddingVertical: 10, backgroundColor: colors.surface,
  },
  backText: { color: colors.teal, fontSize: 14, fontWeight: "700", ...rtl },
});
