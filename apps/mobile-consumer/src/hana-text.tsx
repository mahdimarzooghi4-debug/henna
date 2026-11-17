import { Text as NativeText, StyleSheet, type TextProps } from "react-native";

/** Select the bundled Vazirmatn face that matches the requested weight. */
export function HanaText({ style, ...props }: TextProps) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const fontFamily = weight === "bold" || weight === "700" ||
    weight === "800" || weight === "900"
    ? "Vazirmatn-Bold" : "Vazirmatn-Regular";
  return <NativeText {...props} style={[{ fontFamily }, style]} />;
}
