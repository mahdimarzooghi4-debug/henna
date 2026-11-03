import { useEffect } from "react";
import { Alert, BackHandler, Image, Pressable, ScrollView, StatusBar, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";

const logo = require("../assets/home-logo-badge.png");
const back = require("../assets/social-chevron-right@3x.png");
const actionsIcon = require("../assets/social-action@3x.png");
const heartIcon = require("../assets/social-heart@3x.png");
const starIcon = require("../assets/social-star@3x.png");
const participationIcon = require("../assets/social-participation@3x.png");
const projectImage = require("../assets/social-projects-hero.jpg");
const userNav = require("../assets/figma-nav-user.png");
const ordersNav = require("../assets/figma-nav-receipt.png");
const cartNav = require("../assets/figma-nav-cart.png");
const homeNav = require("../assets/figma-nav-home.png");

type Props = { onBack: () => void; onOrders: () => void; onCart: () => void; onHome: () => void };
const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

function ActionCard({
  title, description, icon, tint, accessibilityLabel,
}: {
  title: string; description: string; icon: number; tint: ViewStyle; accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => Alert.alert(title, "این بخش در پیش‌نمایش به فهرست پروژه‌ها و اطلاعات مشارکت متصل نیست.")}
      style={styles.actionCard}
    >
      <Image source={actionsIcon} style={styles.actionChevron} accessibilityLabel="" />
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <View style={[styles.actionIconWrap, tint]}>
        <Image source={icon} style={styles.actionIcon} accessibilityLabel="" />
      </View>
    </Pressable>
  );
}

export function BuyerSocialParticipationScreen({ onBack, onOrders, onCart, onHome }: Props) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const showPreviewMessage = () => Alert.alert(
    "پروژه‌های همیاری حنا",
    "در این پیش‌نمایش، فهرست پروژه‌ها و ثبت مشارکت به سرویس حنا متصل نیست.",
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به حساب کاربری" onPress={onBack} style={styles.backButton}>
          <Image source={back} style={styles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={styles.headerTitle}>مشارکت اجتماعی</Text>
        <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="حنا" />
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>خرید و مشارکتی که اثرش ادامه پیدا می‌کند</Text>
          <Text style={styles.noticeDescription}>
            در بازار اجتماعی حنا، هر معامله دریچه‌ای است به سوی توسعه پایدار محلی و توانمندسازی افراد جامعه.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>اقدامات و خدمات اجتماعی حنا</Text>
          <ActionCard
            accessibilityLabel="مشاهده طرح‌های اجتماعی فعال"
            title="مشاهده طرح‌های اجتماعی فعال"
            description="لیست پروژه‌های همیاری، سازندگی و زیست‌محیطی جاری در کشور."
            icon={heartIcon}
            tint={styles.heartTint}
          />
          <ActionCard
            accessibilityLabel="مشارکت در یک طرح"
            title="مشارکت در یک طرح"
            description="به‌عنوان یک فرد یا سازمان در یکی از پروژه‌های فعال اجتماعی سهم داشته باشید."
            icon={starIcon}
            tint={styles.starTint}
          />
          <ActionCard
            accessibilityLabel="پیگیری مشارکت‌های من"
            title="پیگیری مشارکت‌های من"
            description="پیگیری وضعیت مشارکت‌های ثبت‌شده در حنا."
            icon={participationIcon}
            tint={styles.participationTint}
          />
        </View>

        <View style={styles.projectCard}>
          <Text style={styles.projectTitle}>معرفی پروژه‌های همیاری حنا</Text>
          <Image source={projectImage} resizeMode="cover" style={styles.projectImage} accessibilityLabel="تصویر یک روستای آباد در میان تپه‌ها" />
          <Text style={styles.projectDescription}>
            طرح‌های اجتماعی در حنا به‌صورت اختیاری و در کنار تجربه بازارگاه نمایش داده می‌شوند. جزئیات هر طرح پیش از مشارکت در دسترس است.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="ورود به تالار همیاری حنا" onPress={showPreviewMessage} style={styles.projectButton}>
            <Text style={styles.projectButtonText}>ورود به تالار همیاری حنا</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.nav}>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="حساب" accessibilityState={{ selected: true }} onPress={onBack}>
          <Image source={userNav} style={[styles.navIcon, styles.navActive]} /><Text style={[styles.navLabel, styles.navLabelActive]}>حساب</Text>
        </Pressable>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="سفارش‌ها" onPress={onOrders}>
          <Image source={ordersNav} style={styles.navIcon} /><Text style={styles.navLabel}>سفارش‌ها</Text>
        </Pressable>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="سبد" onPress={onCart}>
          <Image source={cartNav} style={styles.navIcon} /><Text style={styles.navLabel}>سبد</Text>
        </Pressable>
        <Pressable style={styles.navItem} accessibilityRole="button" accessibilityLabel="خانه" onPress={onHome}>
          <Image source={homeNav} style={styles.navIcon} /><Text style={styles.navLabel}>خانه</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f3ed" },
  fill: { flex: 1 },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  backIcon: { width: 20, height: 20, transform: [{ rotate: "180deg" }] },
  headerTitle: { position: "absolute", left: 70, right: 110, color: "#2d2d2d", fontSize: 18, lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center" },
  logo: { width: 80, height: 36 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100, gap: 20 },
  notice: { width: "100%", padding: 20, borderRadius: 16, backgroundColor: "rgba(15,91,90,0.95)", alignItems: "flex-end", gap: 12 },
  noticeTitle: { width: "100%", color: "#fff", fontSize: 18, lineHeight: 25, fontWeight: "800", ...rtl },
  noticeDescription: { width: "100%", color: "#e8f2f2", fontSize: 12, lineHeight: 18, ...rtl },
  section: { width: "100%", alignItems: "flex-end", gap: 12 },
  sectionTitle: { width: "100%", color: "#2d2d2d", fontSize: 15, lineHeight: 22, fontWeight: "700", ...rtl },
  actionCard: { width: "100%", minHeight: 78, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 12 },
  actionChevron: { width: 18, height: 18 },
  actionCopy: { flex: 1, minWidth: 0, alignItems: "flex-end", gap: 4 },
  actionTitle: { width: "100%", color: "#2d2d2d", fontSize: 14, lineHeight: 20, fontWeight: "700", ...rtl },
  actionDescription: { width: "100%", color: "#8e8e93", fontSize: 11, lineHeight: 17, ...rtl },
  actionIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  actionIcon: { width: 20, height: 20 },
  heartTint: { backgroundColor: "#e8f2f2" },
  starTint: { backgroundColor: "#fdf1ee" },
  participationTint: { backgroundColor: "#f0e7dd" },
  projectCard: { width: "100%", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "flex-end", gap: 14 },
  projectTitle: { width: "100%", color: "#2d2d2d", fontSize: 14, lineHeight: 21, fontWeight: "700", ...rtl },
  projectImage: { width: "100%", height: 130, borderRadius: 12 },
  projectDescription: { width: "100%", color: "#2d2d2d", fontSize: 12, lineHeight: 18, ...rtl },
  projectButton: { width: "100%", minHeight: 54, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  projectButtonText: { color: "#0f5b5a", fontSize: 15, lineHeight: 21, fontWeight: "800", ...rtl, textAlign: "center" },
  nav: { height: 84, paddingHorizontal: 0, paddingTop: 10, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  navItem: { flex: 1, minHeight: 44, alignItems: "center", gap: 4 },
  navIcon: { width: 22, height: 22 },
  navActive: { tintColor: "#0f5b5a" },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, includeFontPadding: false, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
