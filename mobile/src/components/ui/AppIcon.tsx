import Ionicons from "@react-native-vector-icons/ionicons";
import React from "react";

export type AppIconName = React.ComponentProps<typeof Ionicons>["name"];

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
};

export const AppIcon = React.memo(function AppIcon({ name, size = 20, color }: AppIconProps) {
  return <Ionicons name={name} size={size} color={color} />;
});
