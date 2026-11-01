import type { ComponentProps } from "react";
import { Text as NativeText } from "react-native";

const font = { fontFamily: "Estedad" } as const;

export function Text(props: ComponentProps<typeof NativeText>) {
  return <NativeText {...props} style={[props.style, font]} />;
}
