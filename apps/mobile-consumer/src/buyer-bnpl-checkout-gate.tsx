import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text as NativeText, type TextProps, View } from "react-native";
import { bnplProviderDirectory } from "./bnpl-provider-directory";
import { colors } from "./theme";

function Text(props: TextProps) {
  const weight = StyleSheet.flatten(props.style)?.fontWeight;
  return <NativeText {...props} style={[{ fontFamily: weight === "700" || weight === "800" ? "Estedad_700Bold" : "Estedad_400Regular" }, props.style]} />;
}

export function BuyerBnplCheckoutGate() {
  const [openError, setOpenError] = useState("");
  const openProvider = (name: string, website: string) => {
    setOpenError("");
    void Linking.openURL(website).catch(() => setOpenError(`سایت ${name} در این دستگاه باز نشد.`));
  };

  return (
    <View style={styles.container} accessibilityLabel="پرداخت اعتباری با شرکت‌های BNPL">
      <Text style={styles.title}>پرداخت اعتباری با شرکت‌های BNPL</Text>
      <Text style={styles.note}>
        این شرکت‌ها هنوز به درگاه پرداخت حنا متصل نیستند؛ بنابراین اعتبار آن‌ها فعلاً در صورتحساب حنا قابل انتخاب نیست.
      </Text>
      {bnplProviderDirectory.map(provider => (
        <View key={provider.id} style={styles.provider}>
          <View style={styles.copy}>
            <Text style={styles.name}>{provider.name}</Text>
            <Text style={styles.description}>{provider.description}</Text>
            <Text style={styles.status}>روش پرداخت فعال در حنا نیست</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`ورود به سایت ${provider.name}`}
            onPress={() => openProvider(provider.name, provider.website)}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>ورود به سایت</Text>
          </Pressable>
        </View>
      ))}
      {openError ? <Text accessibilityRole="alert" style={styles.status}>{openError}</Text> : null}
      <Text style={styles.footer}>
        دریافت اعتبار در سایت شرکت مستقل انجام می‌شود و به‌تنهایی امکان پرداخت سفارش حنا را ایجاد نمی‌کند.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#EAE2D9",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: "#FAF8F5",
  },
  title: { color: colors.charcoal, fontSize: 14, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  note: { color: "#756D65", fontSize: 12, lineHeight: 20, textAlign: "right", writingDirection: "rtl" },
  provider: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#F0E7DD",
  },
  copy: { flex: 1, minWidth: 0, gap: 3, alignItems: "flex-end" },
  name: { color: colors.charcoal, fontSize: 13, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  description: { color: "#8E8E93", fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  status: { color: "#A44A36", fontSize: 10, textAlign: "right", writingDirection: "rtl" },
  linkButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.paleTeal, alignItems: "center", justifyContent: "center" },
  linkText: { color: colors.teal, fontSize: 11, fontWeight: "700", textAlign: "center" },
  footer: { color: "#8E8E93", fontSize: 10, lineHeight: 17, textAlign: "right", writingDirection: "rtl" },
});
