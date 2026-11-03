import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, BackHandler, Image, Pressable, ScrollView, StatusBar, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "./typography";

const logo = require("../assets/home-logo-badge.png");
const back = require("../assets/addresses-chevron.png");
const add = require("../assets/addresses-plus.png");
const homePin = require("../assets/addresses-map-pin.png");
const officePin = require("../assets/addresses-office.png");
const divider = require("../assets/addresses-divider.png");
const trash = require("../assets/addresses-trash.png");
const pen = require("../assets/addresses-pen.png");
const map = require("../assets/addresses-map-placeholder.jpg");
const userNav = require("../assets/figma-nav-user.png");
const ordersNav = require("../assets/figma-nav-receipt.png");
const cartNav = require("../assets/figma-nav-cart.png");
const homeNav = require("../assets/figma-nav-home.png");

type AddressKind = "home" | "office";
type Address = {
  id: string;
  title: string;
  kind: AddressKind;
  address: string;
  recipient: string;
  phone: string;
  postalCode: string;
  isDefault: boolean;
};
type AddressForm = {
  district: string;
  city: string;
  address: string;
  postalCode: string;
  recipient: string;
  phone: string;
};
type Props = { onBack: () => void; onOrders: () => void; onCart: () => void; onHome: () => void };

const rtl = { textAlign: "right", writingDirection: "rtl" } as const;
const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const toPersianDigits = (value: string) => value.replace(/[0-9]/g, (digit) => faDigits[Number(digit)]);
const normalizeDigits = (value: string) => value.replace(/[۰-۹]/g, (digit) => String(faDigits.indexOf(digit))).replace(/[^0-9]/g, "");
const emptyForm: AddressForm = { district: "", city: "تهران", address: "", postalCode: "", recipient: "", phone: "۰۹۱۲۳۴۵۶۷۸۹" };

const sampleAddresses: Address[] = [
  {
    id: "home-1",
    title: "خانه (تهران)",
    kind: "home",
    address: "تهران، خیابان ولیعصر، نرسیده به میدان ونک، کوچه بابک، پلاک ۱۲، واحد ۴",
    recipient: "کاربر نمونه",
    phone: "۰۹۱۲۳۴۵۶۷۸۹",
    postalCode: "۱۴۳۵۶۷۸۹۰۱",
    isDefault: true,
  },
  {
    id: "office-1",
    title: "دفتر کار",
    kind: "office",
    address: "تهران، بزرگراه صدر، خروجی قلندری، بن‌بست مریم، پلاک ۵، طبقه سوم",
    recipient: "شرکت نمونه",
    phone: "",
    postalCode: "",
    isDefault: false,
  },
];

function SmallAction({ label, icon, tone, onPress, accessibilityLabel }: {
  label: string;
  icon: number;
  tone: "muted" | "teal" | "rust";
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={styles.smallAction}>
      <Text style={[styles.smallActionText, tone === "teal" && styles.smallActionTeal, tone === "rust" && styles.smallActionRust]}>{label}</Text>
      <Image source={icon} style={styles.smallActionIcon} accessibilityLabel="" />
    </Pressable>
  );
}

function AddressCard({
  address, onSetDefault, onEdit, onDelete,
}: {
  address: Address;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.addressCard, address.isDefault ? styles.defaultCard : styles.otherCard]}>
      <View style={styles.addressHeader}>
        {address.isDefault ? (
          <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>آدرس پیش‌فرض</Text></View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={`انتخاب ${address.title} به عنوان پیش‌فرض`} onPress={onSetDefault}>
            <Text style={styles.setDefault}>انتخاب به عنوان پیش‌فرض</Text>
          </Pressable>
        )}
        <View style={styles.addressTitleGroup}>
          <Text style={styles.addressTitle}>{address.title}</Text>
          <Image source={address.kind === "home" ? homePin : officePin} style={styles.addressTypeIcon} accessibilityLabel="" />
        </View>
      </View>
      <Text style={styles.addressText}>{address.address}</Text>
      <Image source={divider} resizeMode="stretch" style={styles.divider} accessibilityLabel="" />
      {address.isDefault ? (
        <View style={styles.detailsRow}>
          <Text style={styles.detailText}>شماره تماس: {address.phone}</Text>
          <Text style={styles.detailText}>گیرنده: {address.recipient}</Text>
        </View>
      ) : null}
      {address.isDefault ? <Image source={divider} resizeMode="stretch" style={styles.divider} accessibilityLabel="" /> : null}
      <View style={styles.addressFooter}>
        <View style={styles.addressActions}>
          <SmallAction label="حذف" icon={trash} tone="muted" onPress={onDelete} accessibilityLabel={`حذف ${address.title}`} />
          <SmallAction label="ویرایش" icon={pen} tone="teal" onPress={onEdit} accessibilityLabel={`ویرایش ${address.title}`} />
        </View>
        {address.postalCode ? (
          <Text style={styles.detailText}>کد پستی: {address.postalCode}</Text>
        ) : (
          <Text style={styles.detailText}>گیرنده: {address.recipient}</Text>
        )}
      </View>
    </View>
  );
}

export function BuyerAddressesScreen({ onBack, onOrders, onCart, onHome }: Props) {
  const [addresses, setAddresses] = useState(sampleAddresses);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const formOffset = useRef(0);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const updateField = (field: keyof AddressForm, value: string) => {
    const normalized = field === "phone" || field === "postalCode" ? toPersianDigits(value.replace(/[^۰-۹0-9]/g, "")) : value;
    const bounded = field === "postalCode" ? normalized.slice(0, 10) : field === "phone" ? normalized.slice(0, 11) : normalized;
    setForm((current) => ({ ...current, [field]: bounded }));
  };

  const scrollToForm = () => scrollRef.current?.scrollTo({ y: Math.max(formOffset.current - 16, 0), animated: true });
  const startNewAddress = () => {
    setEditingId(null);
    setForm(emptyForm);
    scrollToForm();
  };

  const editAddress = (address: Address) => {
    setEditingId(address.id);
    setForm({
      district: "ونک",
      city: "تهران",
      address: address.address,
      postalCode: address.postalCode,
      recipient: address.recipient,
      phone: address.phone || "۰۹۱۲۳۴۵۶۷۸۹",
    });
    scrollToForm();
  };

  const removeAddress = (address: Address) => {
    Alert.alert("حذف نشانی", `نشانی «${address.title}» از فهرست آزمایشی حذف شود؟`, [
      { text: "انصراف", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => setAddresses((current) => {
          const remaining = current.filter((item) => item.id !== address.id);
          if (!address.isDefault || remaining.length === 0) return remaining;
          return remaining.map((item, index) => ({ ...item, isDefault: index === 0 }));
        }),
      },
    ]);
  };

  const setDefault = (id: string) => setAddresses((current) => current.map((item) => ({ ...item, isDefault: item.id === id })));

  const saveAddress = () => {
    const postalCode = normalizeDigits(form.postalCode);
    const phone = normalizeDigits(form.phone);
    if (!form.district.trim() || !form.city.trim() || !form.address.trim() || !form.recipient.trim() || !phone) {
      Alert.alert("اطلاعات نشانی", "محله، شهر، نشانی دقیق، نام و تلفن تحویل‌گیرنده را وارد کنید.");
      return;
    }
    if (postalCode && postalCode.length !== 10) {
      Alert.alert("کد پستی", "کد پستی باید ۱۰ رقم باشد.");
      return;
    }
    const id = editingId ?? `address-${Date.now()}`;
    const next: Address = {
      id,
      kind: "home",
      title: `${form.district.trim()} (${form.city.trim()})`,
      address: form.address.trim(),
      recipient: form.recipient.trim(),
      phone: form.phone,
      postalCode: form.postalCode,
      isDefault: editingId ? Boolean(addresses.find((item) => item.id === editingId)?.isDefault) : addresses.length === 0,
    };
    setAddresses((current) => editingId
      ? current.map((item) => item.id === editingId ? next : item)
      : [...current, next]);
    setEditingId(null);
    setForm(emptyForm);
    Alert.alert("پیش‌نمایش نشانی", "نشانی در همین پیش‌نمایش ثبت شد؛ هنوز به سرویس نشانی متصل نیست.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3ed" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="بازگشت به حساب کاربری" onPress={onBack} style={styles.backButton}>
          <Image source={back} style={styles.backIcon} accessibilityLabel="بازگشت" />
        </Pressable>
        <Text style={styles.headerTitle}>آدرس‌های من</Text>
        <Image source={logo} resizeMode="contain" style={styles.headerLogo} accessibilityLabel="حنا" />
      </View>

      <ScrollView ref={scrollRef} style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeading}>
          <Pressable accessibilityRole="button" accessibilityLabel="افزودن آدرس جدید" onPress={startNewAddress} style={styles.addNew}>
            <Text style={styles.addNewText}>افزودن آدرس جدید</Text>
            <Image source={add} style={styles.addIcon} accessibilityLabel="" />
          </Pressable>
          <Text style={styles.sectionTitle}>لیست آدرس‌های ثبت‌شده</Text>
        </View>

        {addresses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>هنوز آدرسی ثبت نشده است</Text>
            <Text style={styles.emptyDescription}>برای افزودن نشانی، فرم پایین صفحه را تکمیل کنید.</Text>
          </View>
        ) : addresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            onSetDefault={() => setDefault(address.id)}
            onEdit={() => editAddress(address)}
            onDelete={() => removeAddress(address)}
          />
        ))}

        <View style={styles.formCard} onLayout={(event) => { formOffset.current = event.nativeEvent.layout.y; }}>
          <Text style={styles.formTitle}>{editingId ? "ویرایش آدرس" : "فرم ثبت آدرس جدید"}</Text>

          <View style={styles.fieldRow}>
            <View style={styles.halfField}>
              <Text style={styles.label}>محله / منطقه</Text>
              <TextInput accessibilityLabel="محله یا منطقه" value={form.district} onChangeText={(value) => updateField("district", value)} placeholder="مثال: ونک" placeholderTextColor="#8e8e93" style={styles.input} textAlign="right" />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>شهر</Text>
              <TextInput accessibilityLabel="شهر" value={form.city} onChangeText={(value) => updateField("city", value)} placeholder="تهران" placeholderTextColor="#8e8e93" style={styles.input} textAlign="right" />
            </View>
          </View>

          <Field label="نشانی دقیق پستی" accessibilityLabel="نشانی دقیق پستی">
            <TextInput accessibilityLabel="نشانی دقیق پستی" value={form.address} onChangeText={(value) => updateField("address", value)} placeholder="خیابان، کوچه، پلاک، واحد" placeholderTextColor="#8e8e93" style={styles.input} textAlign="right" />
          </Field>

          <Field label="کد پستی (اختیاری)" accessibilityLabel="کد پستی اختیاری">
            <TextInput accessibilityLabel="کد پستی اختیاری" value={form.postalCode} onChangeText={(value) => updateField("postalCode", value)} placeholder="کد ۱۰ رقمی پستی" placeholderTextColor="#8e8e93" keyboardType="number-pad" maxLength={10} style={styles.input} textAlign="right" />
          </Field>

          <View style={styles.fieldRow}>
            <View style={styles.halfField}>
              <Text style={styles.label}>تلفن همراه تحویل‌گیرنده</Text>
              <TextInput accessibilityLabel="تلفن همراه تحویل‌گیرنده" value={form.phone} onChangeText={(value) => updateField("phone", value)} placeholder="۰۹۱۲۳۴۵۶۷۸۹" placeholderTextColor="#8e8e93" keyboardType="phone-pad" maxLength={11} style={styles.input} textAlign="right" />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>نام تحویل‌گیرنده</Text>
              <TextInput accessibilityLabel="نام تحویل‌گیرنده" value={form.recipient} onChangeText={(value) => updateField("recipient", value)} placeholder="مثال: علی احمدی" placeholderTextColor="#8e8e93" style={styles.input} textAlign="right" />
            </View>
          </View>

          <View style={styles.mapField}>
            <Text style={styles.label}>موقعیت روی نقشه</Text>
            <View style={styles.mapContainer}>
              <Image source={map} resizeMode="cover" style={styles.mapImage} accessibilityLabel="پیش‌نمایش نقشه" />
              <Pressable accessibilityRole="button" accessibilityLabel="تغییر موقعیت روی نقشه" onPress={() => Alert.alert("موقعیت روی نقشه", "انتخاب موقعیت در نسخهٔ پیش‌نمایش به نقشهٔ زنده وصل نیست.")} style={styles.mapButton}>
                <Text style={styles.mapButtonText}>تغییر موقعیت روی نقشه</Text>
              </Pressable>
            </View>
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="ثبت آدرس و مشخصات" onPress={saveAddress} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{editingId ? "ذخیره تغییرات" : "ثبت آدرس و مشخصات"}</Text>
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

function Field({ label, accessibilityLabel, children }: { label: string; accessibilityLabel: string; children: ReactNode }) {
  return (
    <View style={styles.fullField} accessibilityLabel={accessibilityLabel}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f3ed" },
  fill: { flex: 1 },
  header: { height: 56, paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  backIcon: { width: 20, height: 20, transform: [{ rotate: "180deg" }] },
  headerTitle: { position: "absolute", left: 70, right: 70, color: "#2d2d2d", fontSize: 18, lineHeight: 25, fontWeight: "700", ...rtl, textAlign: "center" },
  headerLogo: { width: 80, height: 36 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100, gap: 20 },
  sectionHeading: { width: "100%", minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addNew: { flexDirection: "row", alignItems: "center", gap: 6 },
  addNewText: { color: "#b5523b", fontSize: 12, lineHeight: 18, fontWeight: "700", ...rtl },
  addIcon: { width: 14, height: 14 },
  sectionTitle: { color: "#2d2d2d", fontSize: 15, lineHeight: 22, fontWeight: "700", ...rtl },
  addressCard: { width: "100%", padding: 14, borderRadius: 16, backgroundColor: "#fff", gap: 12 },
  defaultCard: { borderWidth: 1.5, borderColor: "#0f5b5a" },
  otherCard: { borderWidth: 1, borderColor: "#f0e7dd" },
  addressHeader: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: "#e8f2f2" },
  defaultBadgeText: { color: "#0f5b5a", fontSize: 10, lineHeight: 15, fontWeight: "700", ...rtl },
  setDefault: { color: "#b5523b", fontSize: 11, lineHeight: 17, fontWeight: "700", ...rtl },
  addressTitleGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressTitle: { color: "#2d2d2d", fontSize: 14, lineHeight: 21, fontWeight: "700", ...rtl },
  addressTypeIcon: { width: 16, height: 16 },
  addressText: { width: "100%", color: "#2d2d2d", fontSize: 13, lineHeight: 20, ...rtl },
  divider: { width: "100%", height: 1 },
  detailsRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  detailText: { color: "#8e8e93", fontSize: 12, lineHeight: 18, ...rtl },
  addressFooter: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  addressActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  smallAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  smallActionText: { color: "#8e8e93", fontSize: 12, lineHeight: 18, ...rtl },
  smallActionTeal: { color: "#0f5b5a" },
  smallActionRust: { color: "#b5523b" },
  smallActionIcon: { width: 14, height: 14 },
  emptyCard: { width: "100%", padding: 18, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "flex-end", gap: 8 },
  emptyTitle: { color: "#2d2d2d", fontSize: 14, fontWeight: "700", ...rtl },
  emptyDescription: { color: "#8e8e93", fontSize: 12, ...rtl },
  formCard: { width: "100%", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#f0e7dd", backgroundColor: "#fff", alignItems: "flex-end", gap: 16 },
  formTitle: { width: "100%", color: "#0f5b5a", fontSize: 15, lineHeight: 23, fontWeight: "700", ...rtl },
  fieldRow: { width: "100%", flexDirection: "row", alignItems: "flex-start", gap: 10 },
  halfField: { flex: 1, minWidth: 0, alignItems: "flex-end", gap: 6 },
  fullField: { width: "100%", alignItems: "flex-end", gap: 6 },
  label: { color: "#2d2d2d", fontSize: 13, lineHeight: 19, fontWeight: "600", ...rtl },
  input: { width: "100%", height: 48, paddingHorizontal: 16, borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 12, backgroundColor: "#fff", color: "#2d2d2d", fontFamily: "Estedad400", fontSize: 14, writingDirection: "rtl" },
  mapField: { width: "100%", alignItems: "flex-end", gap: 6 },
  mapContainer: { width: "100%", height: 120, overflow: "hidden", borderWidth: 1, borderColor: "#f0e7dd", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  mapImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  mapButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#0f5b5a" },
  mapButtonText: { color: "#fff", fontSize: 12, lineHeight: 18, fontWeight: "700", ...rtl },
  saveButton: { width: "100%", minHeight: 54, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, backgroundColor: "#b5523b" },
  saveButtonText: { color: "#fff", fontSize: 15, lineHeight: 21, fontWeight: "800", ...rtl },
  nav: { height: 84, paddingHorizontal: 0, paddingTop: 10, paddingBottom: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "#f0e7dd", backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  navItem: { flex: 1, minHeight: 44, alignItems: "center", gap: 4 },
  navIcon: { width: 22, height: 22 },
  navActive: { tintColor: "#0f5b5a" },
  navLabel: { color: "#8e8e93", fontSize: 10, lineHeight: 15, includeFontPadding: false, ...rtl },
  navLabelActive: { color: "#0f5b5a", fontWeight: "700" },
});
