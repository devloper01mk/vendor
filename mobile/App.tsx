import { AuthedNavigator } from "@/navigation/AuthedNavigator";
import { LoginScreen } from "@/screens/LoginScreen";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import { NavigationContainer, type Theme } from "@react-navigation/native";
import { useEffect } from "react";
import { StatusBar } from "react-native";

const navTheme: Theme = {
  dark: false,
  colors: {
    primary: tokens.color.accent,
    background: tokens.color.background,
    card: tokens.color.panel,
    text: tokens.color.text,
    border: tokens.color.border,
    notification: tokens.color.accent,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "800" },
  },
};

function App(): React.JSX.Element {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (token && user && user.role !== "MEMBER") {
      logout();
    }
  }, [token, user, logout]);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer theme={navTheme}>
        {token && user?.role === "MEMBER" ? <AuthedNavigator /> : <LoginScreen />}
      </NavigationContainer>
    </>
  );
}

export default App;
