import { useEffect, useRef, useState } from "react";
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MobileCatalogClient } from "./mobile-catalog.ts";
import { BuyerProductDetailScreen } from "./buyer-product-detail-screen";
import {
  BROWSE_PAGE_SIZE, BuyerBrowseController, initialBuyerBrowseState,
  type BuyerBrowseState,
} from "./buyer-browse-controller.ts";
import { colors } from "./theme";

const logo = require("../assets/hana-app-logo.png");

// Public catalog access is deliberately independent of MobileAuthClient,
// SecureStore and OTP: the API only sends published identities, never offers.
const catalog = new MobileCatalogClient(
  process.env.EXPO_PUBLIC_HANA_API_BASE_URL, fetch, __DEV__,
);

/** Approved Figma buyer mobile frames 476:4 (empty), 478:22 (API-backed). */
export function BuyerBrowseScreen({ onLogin }: { onLogin: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [browse, setBrowse] = useState<BuyerBrowseState>(initialBuyerBrowseState);
  const [controller] = useState(() =>
    new BuyerBrowseController(catalog, setBrowse));
  const [draftSearch, setDraftSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  function search() {
    if (!controller.submitSearch(draftSearch)) {
      setSearchError("جست‌وجو باید حداکثر ۸۰ نویسه و بدون نویسهٔ کنترلی باشد.");
      return;
    }
    setSearchError("");
  }

  const products = browse.products;
  const categories = browse.categories;
  // Keep the mounted browse coordinator and its real search/filter/page state.
  if (detailId !== null) return (
    <BuyerProductDetailScreen key={detailId} id={detailId} catalog={catalog}
      onBack={() => setDetailId(null)} />
  );
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <KeyboardAvoidingView style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroll} style={styles.fill}
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Image source={logo} resizeMode="contain" style={styles.logo}
              accessibilityLabel="حنا" />
            <Pressable onPress={onLogin} accessibilityRole="button"
              accessibilityLabel="ورود / ثبت‌نام"
              style={({ pressed }) => [styles.headerLink, pressed && styles.pressed]}>
              <Text style={styles.headerLinkText}>ورود</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={styles.intro}>
              <Text style={styles.eyebrow}>مرور کاتالوگ حنا</Text>
              <Text style={styles.title} accessibilityRole="header">
                کالاها را در حنا مرور کنید
              </Text>
              <Text style={styles.description}>
                دسته‌بندی‌ها و کالاهای منتشرشده فقط از API حنا نمایش داده می‌شوند.
              </Text>
            </View>

            <View style={styles.searchRow}>
              <TextInput accessibilityLabel="جست‌وجو در نام کالاها"
                style={styles.searchInput}
                placeholder="جست‌وجو در نام کالاها..."
                placeholderTextColor={colors.muted}
                textAlign="right" returnKeyType="search"
                maxLength={80} value={draftSearch}
                onChangeText={(value) => {
                  setDraftSearch(value);
                  setSearchError("");
                }}
                onSubmitEditing={search} />
              <Pressable accessibilityRole="button"
                accessibilityLabel="جست‌وجو"
                onPress={search}
                style={({ pressed }) =>
                  [styles.searchButton, pressed && styles.pressed]}>
                <Text style={styles.searchButtonText}>جست‌وجو</Text>
              </Pressable>
            </View>
            {searchError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {searchError}
              </Text>
            ) : null}

            <Text style={styles.sectionHeading} accessibilityRole="header">
              دسته‌بندی‌ها
            </Text>
            <View style={styles.sectionPanel}>
              {categories.status === "loading" ? (
                <Text style={styles.muted} accessibilityLiveRegion="polite">
                  در حال دریافت دسته‌بندی‌ها…
                </Text>
              ) : categories.status === "unavailable" ? (
                <>
                  <Text style={styles.errorText} accessibilityRole="alert">
                    دریافت دسته‌بندی‌ها از سرور تأیید نشد.
                  </Text>
                  <Pressable accessibilityRole="button"
                    accessibilityLabel="تلاش دوباره برای دسته‌بندی‌ها"
                    onPress={() => void controller.refreshCategories()}
                    style={styles.retryButton}>
                    <Text style={styles.retryText}>تلاش دوباره</Text>
                  </Pressable>
                </>
              ) : categories.data.length === 0 ? (
                <Text style={styles.muted}>
                  هنوز دسته‌بندی قابل نمایش نداریم.
                </Text>
              ) : (
                <View style={styles.categoryGrid}>
                  <Pressable accessibilityRole="button"
                    accessibilityLabel="همه دسته‌ها"
                    accessibilityState={{ selected: browse.categoryId === null }}
                    onPress={() => controller.chooseCategory(null)}
                    style={[styles.categoryChip,
                      browse.categoryId === null && styles.categorySelected]}>
                    <Text style={styles.categoryText}>همه دسته‌ها</Text>
                  </Pressable>
                  {categories.data.map((category) => (
                    <Pressable key={category.id} accessibilityRole="button"
                      accessibilityLabel={category.name}
                      accessibilityState={{
                        selected: browse.categoryId === category.id,
                      }}
                      onPress={() => controller.chooseCategory(category.id)}
                      style={[styles.categoryChip,
                        browse.categoryId === category.id && styles.categorySelected]}>
                      <Text style={styles.categoryText}>{category.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.sectionHeading} accessibilityRole="header">
              کالاها
            </Text>
            {products.status === "loading" ? (
              <View style={styles.productStatus}>
                <Text style={styles.muted} accessibilityLiveRegion="polite">
                  در حال دریافت کالاها…
                </Text>
              </View>
            ) : products.status === "unavailable" ? (
              <View style={styles.productStatus}>
                <Text style={styles.productTitle} accessibilityRole="header">
                  دریافت کالاها تأیید نشد
                </Text>
                <Text accessibilityRole="alert" style={styles.muted}>
                  ارتباط با کاتالوگ برقرار نشد یا پاسخ قابل اعتماد نبود.
                </Text>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="تلاش دوباره برای کالاها"
                  onPress={() => void controller.refreshProducts()}
                  style={styles.retryButton}>
                  <Text style={styles.retryText}>تلاش دوباره</Text>
                </Pressable>
              </View>
            ) : products.data.items.length === 0 ? (
              <View style={styles.productStatus}>
                <Text style={styles.productTitle} accessibilityRole="header">
                  فعلاً کالایی برای نمایش نداریم
                </Text>
                <Text style={styles.muted}>
                  {browse.search || browse.categoryId
                    ? "در این جست‌وجو یا دسته‌بندی کالای منتشرشده‌ای پیدا نشد."
                    : "پس از انتشار کالاهای واقعی، فهرست اینجا نمایش داده می‌شود."}
                  {" "}خرید هنوز فعال نیست.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.productsPanel}>
                  {products.data.items.map((product) => (
                    <Pressable key={product.id} style={styles.productCard}
                      accessibilityRole="button"
                      accessibilityLabel={`جزئیات ${product.name}`}
                      onPress={() => setDetailId(product.id)}>
                      <Text style={styles.productTitle} accessibilityRole="header">
                        {product.name}
                      </Text>
                      <Text style={styles.productKind}>
                        {product.kind === "SERVICE" ? "خدمت" : "کالا"}
                      </Text>
                      {product.description ? (
                        <Text style={styles.productDescription}>
                          {product.description}
                        </Text>
                      ) : null}
                      <Text style={styles.productDetailLink}>مشاهدهٔ جزئیات</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.paging}>
                  <Text style={styles.pagingLabel}>
                    صفحهٔ {products.data.page} از {Math.max(1,
                      Math.ceil(products.data.total / BROWSE_PAGE_SIZE))}
                  </Text>
                  <View style={styles.pageActions}>
                    <Pressable accessibilityRole="button"
                      accessibilityLabel="صفحهٔ قبل"
                      accessibilityState={{ disabled: browse.page <= 1 }}
                      disabled={browse.page <= 1}
                      onPress={() => {
                        if (controller.previousPage())
                          scroll.current?.scrollTo({ y: 280, animated: true });
                      }}
                      style={[styles.pageButton,
                        browse.page <= 1 && styles.disabled]}>
                      <Text style={styles.retryText}>صفحهٔ قبل</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button"
                      accessibilityLabel="صفحهٔ بعد"
                      accessibilityState={{
                        disabled: browse.page >= 10000 ||
                          browse.page * BROWSE_PAGE_SIZE >= products.data.total,
                      }}
                      disabled={browse.page >= 10000 ||
                        browse.page * BROWSE_PAGE_SIZE >= products.data.total}
                      onPress={() => {
                        if (controller.nextPage())
                          scroll.current?.scrollTo({ y: 280, animated: true });
                      }}
                      style={[styles.pageButton, (browse.page >= 10000 ||
                        browse.page * BROWSE_PAGE_SIZE >= products.data.total) &&
                        styles.disabled]}>
                      <Text style={styles.retryText}>صفحهٔ بعد</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.nonCommerce}>
                  این فهرست برای مرور است؛ قیمت، موجودی و امکان خرید هنوز فعال نیست.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.surface },
  scrollBody: { flexGrow: 1, backgroundColor: colors.surface },
  header: {
    height: 80, paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", backgroundColor: colors.surface,
  },
  logo: { width: 145, height: 48 },
  headerLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  headerLinkText: { color: colors.teal, fontSize: 14, fontWeight: "700", ...rtl },
  pressed: { opacity: .75 },
  content: {
    width: "100%", maxWidth: 560, alignSelf: "center",
    paddingHorizontal: 20, paddingTop: 25, paddingBottom: 48,
  },
  intro: { gap: 7, marginBottom: 18 },
  eyebrow: { color: colors.terracotta, fontSize: 12, ...rtl },
  title: {
    color: colors.charcoal, fontSize: 24, fontWeight: "700",
    lineHeight: 36, ...rtl,
  },
  description: { color: colors.muted, fontSize: 14, lineHeight: 24, ...rtl },
  searchRow: {
    flexDirection: "row-reverse", borderWidth: 1, borderColor: colors.beige,
    borderRadius: 12, backgroundColor: colors.surface,
    minHeight: 56, alignItems: "stretch", overflow: "hidden",
  },
  searchInput: {
    flex: 1, minWidth: 0, fontSize: 14, color: colors.charcoal,
    paddingHorizontal: 14, ...rtl,
  },
  searchButton: {
    backgroundColor: colors.teal, paddingHorizontal: 12,
    alignItems: "center", justifyContent: "center",
  },
  searchButtonText: { color: colors.surface, fontSize: 13, fontWeight: "700" },
  sectionHeading: {
    color: colors.teal, fontSize: 18, fontWeight: "700",
    lineHeight: 34, marginTop: 18, marginBottom: 12, ...rtl,
  },
  sectionPanel: {
    minHeight: 98, padding: 15, borderWidth: 1,
    borderColor: colors.beige, borderRadius: 14,
    backgroundColor: colors.surface, justifyContent: "center",
  },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 26, ...rtl },
  errorText: { color: colors.error, fontSize: 14, lineHeight: 25, ...rtl },
  retryButton: {
    borderWidth: 1, borderColor: colors.teal, borderRadius: 10,
    minHeight: 44, paddingHorizontal: 14, paddingVertical: 8,
    alignItems: "center", alignSelf: "flex-end",
    justifyContent: "center", marginTop: 12,
  },
  retryText: { color: colors.teal, fontSize: 14, fontWeight: "700", ...rtl },
  categoryGrid: {
    flexDirection: "row-reverse", flexWrap: "wrap", gap: 8,
  },
  categoryChip: {
    backgroundColor: colors.paleTeal, width: "48%", minHeight: 68,
    borderRadius: 11, borderWidth: 2, borderColor: "transparent",
    paddingHorizontal: 7, paddingVertical: 12, justifyContent: "center",
  },
  categorySelected: { borderColor: colors.teal },
  categoryText: {
    color: colors.teal, fontSize: 13, fontWeight: "700",
    lineHeight: 24, ...rtl,
  },
  productStatus: {
    minHeight: 197, borderWidth: 1, borderColor: colors.beige,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 17,
    backgroundColor: colors.surface, gap: 7,
  },
  productTitle: {
    color: colors.teal, fontSize: 19, fontWeight: "700",
    lineHeight: 30, ...rtl,
  },
  productsPanel: {
    borderRadius: 16, borderWidth: 1, borderColor: colors.beige,
    padding: 15, gap: 12, backgroundColor: colors.surface,
  },
  productCard: {
    padding: 16, borderWidth: 1, borderColor: colors.beige,
    backgroundColor: colors.cream, borderRadius: 12, gap: 7,
  },
  productKind: { color: colors.muted, fontSize: 14, ...rtl },
  productDetailLink: { color: colors.teal, fontSize: 14, fontWeight: "700", ...rtl },
  productDescription: { color: colors.muted, fontSize: 13, lineHeight: 23, ...rtl },
  paging: { gap: 10, marginTop: 20 },
  pagingLabel: { color: colors.muted, fontSize: 14, ...rtl },
  pageActions: { flexDirection: "row-reverse", gap: 12 },
  pageButton: {
    borderWidth: 1, borderRadius: 10, borderColor: colors.teal,
    minHeight: 44, paddingHorizontal: 14, justifyContent: "center",
  },
  disabled: { opacity: .45 },
  nonCommerce: { color: colors.muted, fontSize: 13, lineHeight: 24, ...rtl },
});
