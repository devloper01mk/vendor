import { AddEntryScreen } from "@/screens/AddEntryScreen";
import { AnalyticsScreen } from "@/screens/AnalyticsScreen";
import { EditEntryScreen } from "@/screens/EditEntryScreen";
import { PaymentScreen } from "@/screens/PaymentScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { SitesScreen } from "@/screens/SitesScreen";
import { TransactionsScreen } from "@/screens/TransactionsScreen";
import { VendorsScreen } from "@/screens/VendorsScreen";
import { tokens } from "@/theme/tokens";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AuthedStackParamList, MainTabParamList } from "./types";
import { VendorDetailsScreen } from "../screens/VendorDetailsScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AuthedStackParamList>();

function EmptyScreen() {
  return <View style={{ flex: 1, backgroundColor: tokens.color.background }} />;
}

const TAB_ICON: Record<string, string> = {
  Dashboard: "\u2302",
  Transactions: "\u25AE",
  Vendors: "\u25C7",
  Sites: "\u25F0",
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const char = TAB_ICON[name] ?? "\u00B7";
  return (
    <Text style={[styles.tabIcon, focused ? styles.tabIconFocused : styles.tabIconIdle]}>{char}</Text>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: tokens.textSize.subtitle,
          color: tokens.color.text,
        },
        headerStyle: {
          backgroundColor: tokens.color.background,
        },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={() => navigation.getParent()?.navigate("Settings")}
            style={({ pressed }) => [styles.settingsBtn, pressed && styles.settingsBtnPressed]}
          >
            <Text style={styles.settingsBtnText}>Settings</Text>
          </Pressable>
        ),
        tabBarActiveTintColor: tokens.color.accent,
        tabBarInactiveTintColor: tokens.color.muted,
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: "#111317",
          height: 74,
          paddingTop: tokens.space[1],
          paddingBottom: tokens.space[1],
        },
        tabBarLabelStyle: {
          fontSize: tokens.textSize.caption,
          fontWeight: "600",
          marginTop: 1,
        },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={AnalyticsScreen} options={{ title: "Dashboard" }} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: "Transaction" }} />
      <Tab.Screen
        name="AddAction"
        component={EmptyScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent()?.navigate("AddEntry");
          },
        })}
        options={{
          title: "",
          tabBarLabel: "",
          tabBarIcon: () => null,
          tabBarButton: ({ ref: _ref, style, children: _children, ...rest }) => (
            <Pressable {...rest} style={[style, styles.addFab]}>
              <Text style={styles.addFabText}>+</Text>
            </Pressable>
          ),
        }}
      />
      <Tab.Screen name="Vendors" component={VendorsScreen} options={{ title: "Vendor" }} />
      <Tab.Screen name="Sites" component={SitesScreen} options={{ title: "Site" }} />
    </Tab.Navigator>
  );
}

export function AuthedNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.color.background },
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: tokens.textSize.subtitle,
          color: tokens.color.text,
        },
        headerTintColor: tokens.color.accent,
      }}
    >
      <Stack.Screen name="HomeTabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
      <Stack.Screen name="VendorDetails" component={VendorDetailsScreen} options={{ title: "Vendor details" }} />
      <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: "New transaction" }} />
      <Stack.Screen name="EditEntry" component={EditEntryScreen} options={{ title: "Edit transaction" }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: "Record payment" }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 24,
    marginBottom: -1,
  },
  tabIconFocused: { color: "#F5F7FA" },
  tabIconIdle: { color: "#8A9099" },
  addFab: {
    alignSelf: "center",
    marginTop: 0,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#15181D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#F1F4F8",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  addFabText: {
    color: "#F7FAFF",
    fontSize: 30,
    lineHeight: 30,
    fontWeight: "400",
    marginTop: -1,
  },
  settingsBtn: {
    paddingHorizontal: tokens.space[2],
    paddingVertical: tokens.space[1],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accentMuted,
  },
  settingsBtnPressed: { opacity: 0.85 },
  settingsBtnText: {
    color: tokens.color.accent,
    fontSize: tokens.textSize.caption,
    fontWeight: "700",
  },
});
