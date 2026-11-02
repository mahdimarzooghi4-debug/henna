import { Alert, Image, Pressable, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";

const logo = require("../assets/home-logo-badge.png");
const backIcon = { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAV0lEQVQ4jWNgGAU0A7yRkV58UZGf+CIjM6ljYFSUD3901D8Q5ouOzKKKofxRUakIQyNyR5ihfNGRWVQNUz5qGsiP7OWYyJxhahgvtRM2L7Wz3ihgIBYAAFeKQhxmPBywAAAAAElFTkSuQmCC" };
const timelineDot = { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA2UlEQVQ4ja1TbQrCMAzNr/mvpedw3mMXKKyvvZIy1OFl1EuoB/Hjp6Kkk1ndOpkzECikSd5LXog+TAETARTCYi9gLt79G4VyLqWoZdlIWrOSMDdpcW91jgElaZ00koU12+pTJDmICWDzVkRy51hS1M2y5iy7YMeRXFWej4mH07/7k4o1M5Iwh58LwOxIWJwHFDgNLXD8AwUMHKJyLuWVdAqo3as1EgsJKHsjABYvKWudsDwDkXzjvm7eg9YJy9PT6YAtgXkzOTznPB/zcHjCvGLetX8D05pzYA8RHXFP8+Y0MwAAAABJRU5ErkJggg==" };
const timelineLine = { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAACCAYAAAAjIj5HAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAFUlEQVQYlWP48Pzu/6GEGQbaAaRiABuVRZimXicOAAAAAElFTkSuQmCC" };
const phoneIcon = { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAABUUlEQVQ4jY2SvUpDQRCFt9IiuTuFhDyHguAjXDCNyMLOmVQpBLG1VBD0CfxpjSAYSKGNvX/gg/gIaqFEUWbv3BATlT1wi7vs+fbMj3POuQLoeOE+CYYkGBCw7cpy3uWoADok+Jr+PPgsC+CB02QCTggInlkM8JoFIDWqgXlzfGYp8hII71YG3k8HIcwZ4CMvQZfXLfKNJbowwGMWYKHXKwh4I8GoEWObwJ8JKLKcBVARcG1l7HnwvTX10OWqEFmxMp59N5YkeK/+sZUN8cBVFZ3vCNgY7wRwpOVoT7Sx9YjTnkwuWyPGthc8mencICnJn59u7KRIZEnpdRItxwsezDDQEeu9etnSmZsSxbhYJ/GCF21sM4TWjztAMMBwBqBK5YAvJ+KOvOCWgANtLAkfW8r+r4BaaTo64mpPZnpQSFz9F1CrFUKTRNY8sKOv68u1+RvUz78pb/Qa4wAAAABJRU5ErkJggg==" };
const userIcon = require("../assets/figma-nav-user.png");
const ordersIcon = require("../assets/figma-nav-receipt.png");
const cartIcon = require("../assets/figma-nav-cart.png");
const homeIcon = require("../assets/figma-nav-home.png");

type Props = {
  onBack: () => void;
  onLogin: () => void;
  onCart: () => void;
  onHome: () => void;
};

const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

const stages = [
  ["تحویل سفارش", "سفارش تحویل داده شد"],
  ["در حال ارسال", "سفارش در حال ارسال است"],
  ["آماده‌سازی سفارش", "اقلام بسته‌بندی شد"],
  ["ثبت سفارش", "سفارش ثبت شد"],
] as const;

export function BuyerOrderTrackingScreen({ onBack, onLogin, onCart, onHome }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به موفقیت سفارش" onPress={onBack} style={styles.headerBack}>
          <Image source={backIcon} style={styles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={styles.headerTitle}>پیگیری سفارش</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.orderCard}>
          <Text style={styles.orderTitle}>سفارش فعال محله</Text>
          <View style={styles.legalBadge}><Text style={styles.legalBadgeText}>خرید حقوقی</Text></View>
          <View style={styles.summaryRow}>
            <Text style={styles.sellerName}>فروشگاه نمونه ۱</Text>
            <Text style={styles.summaryLabel}>فروشنده منتخب:</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>۲ کالا • ۲۶۵,۰۰۰ تومان</Text>
            <Text style={styles.summaryLabel}>خلاصه اقلام:</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.invoiceValue}>فاکتور رسمی: به نام شرکت ثبت‌شده</Text>
            <Text style={styles.summaryLabel}>فاکتور رسمی:</Text>
          </View>
        </View>

        <View style={styles.timelineCard}>
          {stages.map(([title, description], index) => (
            <View key={title} style={[styles.timelineRow, index === stages.length - 1 && styles.finalTimelineRow]}>
              <View style={styles.timelineCopy}>
                <Text style={styles.stageTitle}>{title}</Text>
                <Text style={styles.stageDescription}>{description}</Text>
              </View>
              <View style={styles.timelineRail}>
                <Image source={timelineDot} style={styles.timelineDot} accessibilityLabel="مرحله سفارش" />
                {index < stages.length - 1 ? <View style={styles.timelineStem}><Image source={timelineLine} style={styles.timelineLine} /></View> : null}
              </View>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تماس با پشتیبانی حنا"
          onPress={() => Alert.alert("راهنمایی سفارش", "پشتیبانی تلفنی در نسخهٔ نمایشی فعال نیست.")}
          style={styles.helpCard}
        >
          <View style={styles.helpCopy}>
            <Text style={styles.helpTitle}>نیاز به راهنمایی دارید؟</Text>
            <Text style={styles.helpDescription}>سوالی دارید؟ در هر مرحله از سفارش همراه شما هستیم.</Text>
          </View>
          <View style={styles.phoneWrap}><Image source={phoneIcon} style={styles.phoneIcon} accessibilityLabel="تماس" /></View>
        </Pressable>
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={onLogin}>
          <Image source={userIcon} style={styles.navIcon} accessibilityLabel="حساب" />
          <Text style={styles.navLabel}>حساب</Text>
        </Pressable>
        <Pressable style={styles.navItem} accessibilityState={{ selected: true }}>
          <Image source={ordersIcon} style={[styles.navIcon, styles.navIconActive]} accessibilityLabel="سفارش‌ها" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>سفارش‌ها</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={onCart}>
          <Image source={cartIcon} style={styles.navIcon} accessibilityLabel="سبد" />
          <Text style={styles.navLabel}>سبد</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={onHome}>
          <Image source={homeIcon} style={styles.navIcon} accessibilityLabel="خانه" />
          <Text style={styles.navLabel}>خانه</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#f7f3ed" },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f7f3ed" },
  headerBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff" },
  backIcon: { width: 20, height: 20, transform: [{ rotate: "180deg" }] },
  headerTitle: { position: "absolute", left: 70, right: 70, color: "#2d2d2d", fontSize: 18, lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center" },
  logo: { width: 80, height: 36 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100, gap: 16 },
  orderCard: { width: "100%", height: 188, padding: 14, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff", alignItems: "flex-end", justifyContent: "space-between" },
  orderTitle: { color: "#2d2d2d", fontSize: 15, fontWeight: "700", ...rtl },
  legalBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#e8f2f2" },
  legalBadgeText: { color: "#0f5b5a", fontSize: 10, fontWeight: "700", ...rtl },
  summaryRow: { width: "100%", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  sellerName: { color: "#0f5b5a", fontSize: 13, fontWeight: "700", ...rtl },
  summaryValue: { color: "#2d2d2d", fontSize: 13, ...rtl },
  invoiceValue: { color: "#0f5b5a", fontSize: 13, fontWeight: "700", ...rtl },
  summaryLabel: { color: "#8e8e93", fontSize: 13, ...rtl },
  timelineCard: { width: "100%", height: 328, padding: 20, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 16, backgroundColor: "#fff", gap: 20 },
  timelineRow: { width: "100%", height: 60, flexDirection: "row", alignItems: "flex-start", gap: 16 },
  finalTimelineRow: { height: 16 },
  timelineCopy: { flex: 1, alignItems: "flex-end", gap: 4, paddingTop: 1 },
  stageTitle: { color: "#2d2d2d", fontSize: 14, fontWeight: "700", lineHeight: 20, ...rtl },
  stageDescription: { color: "#8e8e93", fontSize: 11, lineHeight: 16, ...rtl },
  timelineRail: { width: 24, alignItems: "center" },
  timelineDot: { width: 16, height: 16 },
  timelineStem: { width: 24, height: 44, alignItems: "center", justifyContent: "center" },
  timelineLine: { position: "absolute", width: 44, height: 2, transform: [{ rotate: "90deg" }] },
  helpCard: { width: "100%", minHeight: 72, padding: 14, borderRadius: 12, backgroundColor: "#e8f2f2", flexDirection: "row", alignItems: "center", gap: 12 },
  helpCopy: { flex: 1, alignItems: "flex-end", gap: 2 },
  helpTitle: { color: "#0f5b5a", fontSize: 13, fontWeight: "700", ...rtl },
  helpDescription: { color: "#8e8e93", fontSize: 11, ...rtl },
  phoneWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  phoneIcon: { width: 16, height: 16 },
  bottomNav: { height: 84, paddingHorizontal: 0, paddingTop: 10, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderTopWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  navIcon: { width: 22, height: 22, opacity: 0.54 },
  navIconActive: { opacity: 1 },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
