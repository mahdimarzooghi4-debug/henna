import { useState } from "react";
import {
  Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./theme";

const logo = require("../assets/hana-app-logo.png");
const product = require("../assets/rice-product-detail.png");
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export function FigmaProductDetailScreen({ onBack }: { onBack: () => void }) {
  const [quantity, setQuantity] = useState(1);
  const [cartQuantity, setCartQuantity] = useState(0);
  const [showCart, setShowCart] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [paymentChoice, setPaymentChoice] = useState("online");
  const [specificationsOpen, setSpecificationsOpen] = useState(true);
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [favorite, setFavorite] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت"
          onPress={() => showCheckout ? setShowCheckout(false) : showReview ? setShowReview(false) : showComparison ? setShowComparison(false) : showCart ? setShowCart(false) : onBack()}
          style={styles.headerBack}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{showCheckout ? "ثبت سفارش" : showReview ? "بررسی سبد" : showComparison ? "مقایسه فروشگاه‌ها" : showCart ? "سبد خرید" : "جزئیات محصول"}</Text>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="حنا" />
      </View>

      {showCheckout ? (
        <ScrollView contentContainerStyle={styles.checkoutView} showsVerticalScrollIndicator={false}>
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutHeading}>آدرس و مشخصات تحویل‌گیرنده  ◉</Text>
            <TextInput style={styles.checkoutAddress} defaultValue="آدرس نمونه" textAlign="right" />
            <View style={styles.checkoutMeta}><Text style={styles.checkoutMuted}>تحویل‌گیرنده: کاربر نمونه</Text><Text style={styles.checkoutMuted}>شماره تماس: نمونه</Text></View>
          </View>
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutHeading}>شیوه و زمان ارسال  ▫</Text>
            <View style={styles.deliveryPill}><Text style={styles.deliveryText}>فروشنده انتخاب‌شده: {selectedSeller || "فروشگاه نمونه ۱"}</Text></View>
            <Text style={styles.checkoutMuted}>سفارش پس از تایید نهایی، از فروشگاه انتخاب‌شده ارسال می‌شود.</Text>
          </View>
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutHeading}>روش پرداخت</Text>
            {[["online", "درگاه آنلاین بانکی", "پرداخت امن با کلیه کارت‌های عضو شتاب"], ["support", "اعتبار حمایتی موجود", "اعتبار حمایتی یک منبع پرداخت جداگانه است و بر اساس قوانین موجود در دسترس خواهد بود."], ["personal", "اعتبار شخصی تأمین‌شده توسط کاربر", "این منبع پرداخت برای کارت‌های شخصی و بر اساس شرایط موجود برای کاربر فعال است."], ["legal", "خرید حقوقی و دریافت فاکتور رسمی", "با فعال‌کردن این گزینه، فاکتور سفارش به نام شرکت صادر می‌شود."]].map(([key, label, description]) => (
              <Pressable key={key} onPress={() => setPaymentChoice(key)} style={[styles.checkoutOption, paymentChoice === key && styles.checkoutOptionSelected]}>
                <View style={[styles.radioOuter, paymentChoice === key && styles.radioSelected]}><View style={[styles.radioInner, paymentChoice === key && styles.radioInnerSelected]} /></View>
                <View style={styles.checkoutOptionCopy}><Text style={styles.checkoutOptionTitle}>{label}</Text><Text style={styles.checkoutMuted}>{description}</Text></View>
              </Pressable>
            ))}
          </View>
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutHeading}>خلاصه صورت‌حساب</Text>
            <View style={styles.cartSummaryLine}><Text style={styles.checkoutMuted}>مجموع اقلام سبد:</Text><Text style={styles.cartProduct}>{fa(cartQuantity * 185000)} تومان</Text></View>
            <View style={styles.cartSummaryLine}><Text style={styles.checkoutMuted}>هزینه ارسال:</Text><Text style={styles.cartProduct}>رایگان</Text></View>
            <View style={styles.summaryDivider} />
            <View style={styles.cartSummaryLine}><Text style={styles.cartProduct}>جمع فعلی کالاها:</Text><Text style={styles.sellerPrice}>{fa(cartQuantity * 185000)} تومان</Text></View>
          </View>
          {checkoutNotice ? <Text style={styles.success} accessibilityLiveRegion="polite">{checkoutNotice}</Text> : null}
          <Pressable accessibilityRole="button" style={styles.compareButton} onPress={() => setCheckoutNotice("این صفحه پیش‌نمایش است و پرداخت یا سفارش واقعی انجام نمی‌شود.")}>
            <Text style={styles.chooseSellerText}>ثبت نهایی و پرداخت سفارش</Text>
          </Pressable>
        </ScrollView>
      ) : showReview ? (
        <ScrollView contentContainerStyle={styles.cartView} showsVerticalScrollIndicator={false}>
          <View style={styles.cartSummary}>
            <Text style={styles.cartMuted}>فروشگاه انتخاب‌شده شما</Text>
            <Text style={styles.cartProduct}>{selectedSeller || "فروشگاه نمونه ۱ (محله رسالت)"}</Text>
            <Text style={styles.cartMuted}>فاصله تا شما: ۱.۲ کیلومتر · ارسال از فروشگاه انتخاب‌شده</Text>
          </View>
          <Text style={styles.cartProduct}>لیست اقلام آماده ارسال</Text>
          {cartQuantity > 0 && <View style={styles.cartItem}>
            <View style={styles.cartCopy}>
              <Text style={styles.cartProduct}>برنج طارم ایرانی درجه یک (۱۰ کیلویی)</Text>
              <Text style={styles.cartMuted}>تعداد: {fa(cartQuantity)} کیسه · ۱۸۵,۰۰۰ تومان</Text>
            </View>
            <Image source={product} style={styles.cartImage} />
          </View>}
          <View style={styles.cartSummary}>
            <View style={styles.cartSummaryLine}><Text style={styles.cartMuted}>مجموع اقلام سبد:</Text><Text style={styles.cartProduct}>{fa(cartQuantity * 185000)} تومان</Text></View>
            <View style={styles.cartSummaryLine}><Text style={styles.cartMuted}>هزینه ارسال:</Text><Text style={styles.cartProduct}>رایگان</Text></View>
            <View style={styles.summaryDivider} />
            <View style={styles.cartSummaryLine}><Text style={styles.cartProduct}>مبلغ قابل پرداخت:</Text><Text style={styles.sellerPrice}>{fa(cartQuantity * 185000)} تومان</Text></View>
          </View>
          {checkoutNotice ? <Text style={styles.success} accessibilityLiveRegion="polite">{checkoutNotice}</Text> : null}
          <Pressable accessibilityRole="button" style={styles.compareButton}
            onPress={() => { setCheckoutNotice(""); setShowCheckout(true); }}>
            <Text style={styles.chooseSellerText}>ادامه ثبت سفارش</Text>
          </Pressable>
        </ScrollView>
      ) : showComparison ? (
        <ScrollView contentContainerStyle={styles.cartView} showsVerticalScrollIndicator={false}>
          <View style={styles.cartSummary}>
            <Text style={styles.cartMuted}>فروشگاه‌های نزدیک</Text>
            <Text style={styles.cartProduct}>برای همین سبد، فروشگاه را انتخاب کنید.</Text>
          </View>
          {[{name:"فروشگاه نمونه ۳", distance:"۲.۴ کیلومتر", price:260000, tag:"کمترین قیمت کل"},
            {name:"فروشگاه نمونه ۱", distance:"۱.۲ کیلومتر", price:265000, tag:"کامل‌ترین سبد"},
            {name:"فروشگاه نمونه ۲", distance:"۰.۸ کیلومتر", price:270000, tag:"نزدیک‌ترین"}].map((seller) => (
            <View key={seller.name} style={styles.sellerCard}>
              <View style={styles.sellerTags}><Text style={styles.sellerTag}>{seller.tag}</Text></View>
              <Text style={styles.cartProduct}>{seller.name}</Text>
              <Text style={styles.cartMuted}>۱ از ۱ کالا موجود · فاصله تا شما: {seller.distance}</Text>
              <Text style={styles.cartMuted}>زمان تحویل پس از انتخاب فروشگاه مشخص می‌شود.</Text>
              <View style={styles.sellerFooter}>
                <Text style={styles.sellerPrice}>{fa(seller.price)} تومان</Text>
                <Pressable onPress={() => { setSelectedSeller(seller.name); setShowComparison(false); }} style={styles.chooseSeller}>
                  <Text style={styles.chooseSellerText}>{selectedSeller === seller.name ? "انتخاب شد" : "انتخاب این فروشگاه"}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : showCart ? (
        <ScrollView contentContainerStyle={styles.cartView} showsVerticalScrollIndicator={false}>
          {cartQuantity === 0 ? <View style={styles.cartSummary}>
            <Text style={styles.cartTitle} accessibilityRole="header">سبد خرید خالی است</Text>
            <Text style={styles.cartMuted}>از صفحه‌ی محصول کالا به سبد اضافه کن.</Text>
          </View> : <>
            <View style={styles.cartItem}>
              <View style={styles.cartCopy}>
                <Text style={styles.cartProduct}>برنج طارم ایرانی درجه یک (۱۰ کیلویی)</Text>
                <Text style={styles.cartMuted}>قیمت مبنا: ۱۸۵,۰۰۰ تومان</Text>
                <View style={styles.cartItemActions}>
                  <Pressable accessibilityRole="button" onPress={() => setCartQuantity(0)}>
                    <Text style={styles.removeText}>حذف</Text>
                  </Pressable>
                  <View style={styles.cartStepper}>
                    <Pressable accessibilityLabel="افزایش تعداد سبد" onPress={() => setCartQuantity((n) => Math.min(99, n + 1))}><Text style={styles.stepPlus}>+</Text></Pressable>
                    <Text style={styles.quantity}>{fa(cartQuantity)}</Text>
                    <Pressable accessibilityLabel="کاهش تعداد سبد" onPress={() => setCartQuantity((n) => Math.max(1, n - 1))}><Text style={styles.stepMinus}>−</Text></Pressable>
                  </View>
                </View>
              </View>
              <Image source={product} style={styles.cartImage} />
            </View>
            <View style={styles.cartSummary}>
              <View style={styles.cartSummaryLine}><Text style={styles.cartMuted}>مجموع اقلام سبد:</Text><Text style={styles.cartProduct}>{fa(cartQuantity * 185000)} تومان</Text></View>
              <View style={styles.cartSummaryLine}><Text style={styles.cartMuted}>تخفیف‌های قابل اعمال:</Text><Text style={styles.cartProduct}>۰ تومان</Text></View>
              <View style={styles.summaryDivider} />
              <View style={styles.cartSummaryLine}><Text style={styles.cartProduct}>قیمت حدودی سبد:</Text><Text style={styles.sellerPrice}>{fa(cartQuantity * 185000)} تومان</Text></View>
            </View>
            <View style={styles.compareHint}>
              <Text style={styles.cartProduct}>مقایسه فروشگاه‌های نزدیک</Text>
              <Text style={styles.cartMuted}>حنا این سبد را بر اساس قیمت، فاصله و موجودی فروشگاه‌ها مقایسه می‌کند.</Text>
            </View>
            {selectedSeller && <Text style={styles.success} accessibilityLiveRegion="polite">{selectedSeller} انتخاب شد.</Text>}
            <Pressable accessibilityRole="button" disabled={cartQuantity === 0}
              onPress={() => setShowComparison(true)} style={styles.compareButton}>
              <Text style={styles.chooseSellerText}>مقایسه فروشگاه‌ها</Text>
            </Pressable>
            {selectedSeller && <Pressable accessibilityRole="button"
              onPress={() => setShowReview(true)} style={styles.continueReview}>
              <Text style={styles.continueReviewText}>ادامه به بررسی سبد</Text>
            </Pressable>}
          </>}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.imageFrame}>
            <Image source={product} style={styles.hero} resizeMode="cover" accessibilityLabel="برنج طارم ایرانی درجه یک" />
            <Pressable accessibilityRole="button"
              accessibilityLabel={favorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
              onPress={() => setFavorite((value) => !value)} style={styles.heartButton}>
              <Text style={[styles.heart, favorite && styles.heartActive]}>{favorite ? "♥" : "♡"}</Text>
            </Pressable>
          </View>

          <View style={styles.guidance}>
            <View style={styles.infoMark}><Text style={styles.infoText}>i</Text></View>
            <Text style={styles.guidanceText}>
              این کالا در بازارگاه ثبت شده است. بعد از افزودن به سبد، می‌توانید فروشنده‌ها را مقایسه کنید.
            </Text>
          </View>

          <View style={styles.productInfo}>
            <View style={styles.badges}>
              <Text style={styles.marketBadge}>موجود در بازارگاه</Text>
              <Text style={styles.sampleBadge}>نمونه کالا</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header">
              برنج طارم ایرانی درجه یک دم‌سیاه (کیسه ۱۰ کیلویی)
            </Text>
            <View style={styles.priceLine}>
              <Text style={styles.priceLabel}>قیمت نمونه:</Text>
              <Text style={styles.price}>۱۸۵,۰۰۰ تومان</Text>
            </View>
          </View>

          <View style={styles.buyBar}>
            <Pressable accessibilityRole="button"
              onPress={() => setCartQuantity((value) => Math.min(99, value + quantity))}
              style={styles.addButton}>
              <Text style={styles.addText}>افزودن به سبد خرید</Text>
            </Pressable>
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="افزایش تعداد"
                disabled={quantity >= 99} onPress={() => setQuantity((value) => Math.min(99, value + 1))}
                style={styles.stepUp}><Text style={styles.stepPlus}>+</Text></Pressable>
              <Text style={styles.quantity}>{fa(quantity)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="کاهش تعداد"
                disabled={quantity <= 1} onPress={() => setQuantity((value) => Math.max(1, value - 1))}
                style={styles.stepDown}><Text style={styles.stepMinus}>−</Text></Pressable>
            </View>
          </View>
          {cartQuantity > 0 && <Text style={styles.success} accessibilityLiveRegion="polite">
            {fa(cartQuantity)} عدد برنج به سبد اضافه شد.
          </Text>}

          <View style={styles.accordion}>
            <Pressable onPress={() => setSpecificationsOpen((value) => !value)}
              accessibilityRole="button" accessibilityState={{ expanded: specificationsOpen }} style={styles.accordionHead}>
              <Text style={styles.chevron}>{specificationsOpen ? "⌄" : "›"}</Text>
              <Text style={styles.accordionTitle}>مشخصات و ویژگی‌ها</Text>
            </Pressable>
            {specificationsOpen && <View style={styles.accordionBody}>
              <Text style={styles.detailText}>نوع محصول: برنج طارم</Text>
              <Text style={styles.detailText}>وزن: کیسه ۱۰ کیلوگرمی</Text>
              <Text style={styles.detailText}>بسته‌بندی: کیسه</Text>
            </View>}
          </View>
          <View style={styles.accordion}>
            <Pressable onPress={() => setDescriptionOpen((value) => !value)}
              accessibilityRole="button" accessibilityState={{ expanded: descriptionOpen }} style={styles.accordionHead}>
              <Text style={styles.chevron}>{descriptionOpen ? "⌄" : "›"}</Text>
              <Text style={styles.accordionTitle}>توضیحات محصول</Text>
            </Pressable>
            {descriptionOpen && <Text style={styles.description}>
              این کالا به‌عنوان نمونه در بازارگاه ثبت شده است. بعد از افزودن به سبد، می‌توانید فروشنده‌ها را مقایسه کنید و سفارش خود را ثبت کنید.
            </Text>}
          </View>
          <Text style={styles.disclosure}>قیمت این صفحه نمونه‌ای است و سفارش واقعی ثبت نمی‌کند.</Text>
        </ScrollView>
      )}

      <View style={styles.bottomNav}>
        <Pressable onPress={() => setShowCart(false)} style={styles.navItem}>
          <Text style={styles.navIcon}>♙</Text><Text style={styles.navLabel}>حساب</Text>
        </Pressable>
        <Pressable onPress={() => setShowCart(false)} style={styles.navItem}>
          <Text style={styles.navIcon}>▤</Text><Text style={styles.navLabel}>سفارش‌ها</Text>
        </Pressable>
        <Pressable onPress={() => { setShowCart(true); setShowComparison(false); setShowReview(false); }} style={styles.navItem}>
          <Text style={[styles.navIcon, showCart && styles.navSelected]}>▱</Text>
          <Text style={[styles.navLabel, showCart && styles.navSelected]}>سبد{cartQuantity ? ` · ${fa(cartQuantity)}` : ""}</Text>
        </Pressable>
        <Pressable onPress={onBack} style={styles.navItem}>
          <Text style={styles.navIcon}>⌂</Text><Text style={styles.navLabel}>خانه</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { height: 56, paddingHorizontal: 20, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  headerBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "#F0E7DD", backgroundColor: colors.surface },
  backIcon: { color: colors.teal, fontSize: 28, lineHeight: 30 },
  headerTitle: { color: colors.charcoal, fontSize: 18, fontWeight: "700", ...rtl },
  logo: { width: 80, height: 36 },
  scroll: { paddingHorizontal: 20, paddingBottom: 112, gap: 20 },
  imageFrame: { height: 240, borderRadius: 20, overflow: "hidden", position: "relative" },
  hero: { width: "100%", height: "100%" },
  heartButton: { position: "absolute", top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  heart: { color: colors.terracotta, fontSize: 22 },
  heartActive: { color: colors.terracotta },
  guidance: { minHeight: 58, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.teal, backgroundColor: "#E8F2F2", flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  infoMark: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  infoText: { color: colors.teal, fontSize: 14, fontWeight: "800" },
  guidanceText: { flex: 1, color: colors.teal, fontSize: 12, lineHeight: 18, fontWeight: "600", ...rtl },
  productInfo: { alignItems: "flex-end", gap: 12 },
  badges: { flexDirection: "row-reverse", gap: 8 },
  marketBadge: { backgroundColor: "#E8F2F2", color: colors.teal, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11, fontWeight: "600", ...rtl },
  sampleBadge: { backgroundColor: "#FDF1EE", color: colors.terracotta, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11, fontWeight: "600", ...rtl },
  title: { width: "100%", color: colors.charcoal, fontSize: 20, lineHeight: 31, fontWeight: "800", ...rtl },
  priceLine: { flexDirection: "row-reverse", alignItems: "baseline", gap: 8 },
  priceLabel: { color: "#8E8E93", fontSize: 13, ...rtl },
  price: { color: colors.teal, fontSize: 22, fontWeight: "800", ...rtl },
  buyBar: { minHeight: 70, padding: 10, gap: 8, flexDirection: "row-reverse", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: "#F0E7DD", borderRadius: 16 },
  addButton: { flex: 1, minHeight: 48, borderRadius: 10, backgroundColor: colors.terracotta, alignItems: "center", justifyContent: "center" },
  addText: { color: colors.surface, fontSize: 14, fontWeight: "700", ...rtl },
  stepper: { flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  stepUp: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#FDF1EE" },
  stepPlus: { color: colors.terracotta, fontSize: 16, fontWeight: "700" },
  stepDown: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#F0E7DD" },
  stepMinus: { color: "#8E8E93", fontSize: 16, fontWeight: "700" },
  quantity: { color: colors.charcoal, fontSize: 16, fontWeight: "700" },
  success: { color: colors.teal, fontSize: 12, textAlign: "right", ...rtl },
  accordion: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#F0E7DD", backgroundColor: colors.surface, gap: 10 },
  accordionHead: { minHeight: 20, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  accordionTitle: { color: colors.charcoal, fontSize: 14, fontWeight: "700", ...rtl },
  chevron: { color: colors.muted, fontSize: 17 },
  accordionBody: { borderTopWidth: 1, borderTopColor: "#F0E7DD", paddingTop: 10, gap: 6 },
  detailText: { color: colors.charcoal, fontSize: 12, ...rtl },
  description: { color: "#8E8E93", fontSize: 12, lineHeight: 18, ...rtl },
  disclosure: { color: colors.muted, fontSize: 10, ...rtl },
  bottomNav: { height: 84, position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingTop: 9, paddingBottom: 18, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: "#F0E7DD", flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-around", shadowColor: "#000", shadowOpacity: .1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navIcon: { color: "#8E8E93", fontSize: 21, height: 22 },
  navLabel: { color: "#8E8E93", fontSize: 10, ...rtl },
  navSelected: { color: colors.teal, fontWeight: "700" },
  cartView: { flex: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 110, gap: 14 },
  checkoutView: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110, gap: 14 },
  checkoutCard: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#F0E7DD", gap: 12 },
  checkoutHeading: { color: colors.charcoal, fontSize: 15, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  checkoutAddress: { minHeight: 42, borderBottomWidth: 1, borderBottomColor: "#F0E7DD", color: colors.charcoal, fontSize: 14, writingDirection: "rtl" },
  checkoutMeta: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 8 },
  checkoutMuted: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  deliveryPill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: "#E8F2F2" },
  deliveryText: { color: colors.teal, fontSize: 13, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  checkoutOption: { minHeight: 60, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#F0E7DD", flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  checkoutOptionSelected: { borderColor: colors.teal, backgroundColor: "#E8F2F2" },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: "#A0A0A0", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: colors.teal, borderWidth: 3 },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "transparent" },
  radioInnerSelected: { backgroundColor: colors.teal },
  checkoutOptionCopy: { flex: 1, gap: 3 },
  checkoutOptionTitle: { color: colors.charcoal, fontSize: 13, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  cartTitle: { color: colors.charcoal, fontSize: 22, fontWeight: "800", ...rtl },
  cartMuted: { color: colors.muted, fontSize: 13, lineHeight: 22, ...rtl },
  cartItem: { padding: 12, borderRadius: 12, backgroundColor: colors.surface, flexDirection: "row-reverse", gap: 12, alignItems: "center" },
  cartImage: { width: 72, height: 72, borderRadius: 8 },
  cartCopy: { flex: 1, gap: 5 },
  cartProduct: { color: colors.teal, fontSize: 14, fontWeight: "700", ...rtl },
  cartSummary: { padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#F0E7DD", gap: 8 },
  cartSummaryLine: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 },
  summaryDivider: { height: 1, backgroundColor: "#F0E7DD" },
  cartItemActions: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  removeText: { color: colors.terracotta, fontSize: 12, fontWeight: "600", ...rtl },
  cartStepper: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: colors.cream, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  compareHint: { padding: 14, borderRadius: 12, backgroundColor: "#E8F2F2", borderWidth: 1, borderColor: colors.teal, gap: 6 },
  compareButton: { minHeight: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.terracotta },
  sellerCard: { padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#F0E7DD", gap: 8 },
  sellerTags: { flexDirection: "row-reverse" },
  sellerTag: { color: colors.teal, backgroundColor: "#E8F2F2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11, fontWeight: "700", ...rtl },
  sellerFooter: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#F0E7DD", paddingTop: 8 },
  sellerPrice: { color: colors.terracotta, fontSize: 17, fontWeight: "800", ...rtl },
  chooseSeller: { backgroundColor: colors.teal, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  chooseSellerText: { color: colors.surface, fontSize: 13, fontWeight: "700", ...rtl },
  continueReview: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.terracotta, alignItems: "center", justifyContent: "center" },
  continueReviewText: { color: colors.terracotta, fontSize: 13, fontWeight: "700", ...rtl },
});
