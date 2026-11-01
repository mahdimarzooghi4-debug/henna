import type { ComponentProps } from "react";
import { StyleSheet, Text as NativeText } from "react-native";

const fontByWeight: Record<string, string> = {
  "100": "Estedad100",
  "200": "Estedad200",
  "300": "Estedad300",
  "400": "Estedad400",
  normal: "Estedad400",
  "500": "Estedad500",
  "600": "Estedad600",
  "700": "Estedad700",
  bold: "Estedad700",
  "800": "Estedad800",
  "900": "Estedad900",
};

export function Text(props: ComponentProps<typeof NativeText>) {
  const style = StyleSheet.flatten(props.style);
  const fontFamily = fontByWeight[String(style?.fontWeight ?? "400")] ?? "Estedad400";
  return (
    <NativeText
      {...props}
      style={[props.style, { fontFamily, fontWeight: "normal" }]}
    />
  );
}
