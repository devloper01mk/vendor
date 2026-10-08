import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { AddEntryScreen } from "@/screens/AddEntryScreen";
import { AnalyticsScreen } from "@/screens/AnalyticsScreen";
import { EditEntryScreen } from "@/screens/EditEntryScreen";
import { PaymentScreen } from "@/screens/PaymentScreen";
import { ScopedTransactionsScreen } from "@/screens/ScopedTransactionsScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { SiteDetailsScreen } from "@/screens/SiteDetailsScreen";
import { SitesScreen } from "@/screens/SitesScreen";
import { TransactionsScreen } from "@/screens/TransactionsScreen";
import { VendorDetailsScreen } from "@/screens/VendorDetailsScreen";
import { VendorsScreen } from "@/screens/VendorsScreen";
import { tokens } from "@/theme/tokens";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, View } from "react-native";
import type { AuthedStackParamList, MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AuthedStackParamList>();

function EmptyScreen() {
  return <View style={{ flex: 1, backgroundColor: tokens.color.background }} />;
}

const TAB_ICON: Record<string, AppIconName> = {
  Dashboard: "grid-outline",
  Transactions: "list-outline",
  Vendors: "people-outline",
  Sites: "location-outline",
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconName = TAB_ICON[name] ?? "ellipse-outline";
  const color = focused ? tokens.color.sidebarText : tokens.color.sidebarMuted;
  return <AppIcon name={iconName} size={22} color={color} />;
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
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
            <AppIcon name="settings-outline" size={16} color={tokens.color.sidebarText} />
          </Pressable>
        ),
        tabBarActiveTintColor: tokens.color.sidebarText,
        tabBarInactiveTintColor: tokens.color.sidebarMuted,
        tabBarStyle: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: tokens.color.sidebarBorder,
          backgroundColor: tokens.color.sidebar,
          height: 72,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarItemStyle: {
          borderRadius: tokens.radius.sm,
          marginHorizontal: 2,
        },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={AnalyticsScreen} options={{ title: "Dashboard" }} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: "Transactions" }} />
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
              <AppIcon name="add" size={26} color={tokens.color.sidebarText} />
            </Pressable>
          ),
        }}
      />
      <Tab.Screen name="Vendors" component={VendorsScreen} options={{ title: "Vendors" }} />
      <Tab.Screen name="Sites" component={SitesScreen} options={{ title: "Sites" }} />
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
      <Stack.Screen name="SiteDetails" component={SiteDetailsScreen} options={{ title: "Site details" }} />
      <Stack.Screen name="VendorDetails" component={VendorDetailsScreen} options={{ title: "Vendor details" }} />
      <Stack.Screen
        name="ScopedTransactions"
        component={ScopedTransactionsScreen}
        options={{ title: "Transactions" }}
      />
      <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: "New transaction" }} />
      <Stack.Screen name="EditEntry" component={EditEntryScreen} options={{ title: "Edit transaction" }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: "Record payment" }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  addFab: {
    alignSelf: "center",
    marginTop: -4,
    width: 54,
    height: 54,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sidebar,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: tokens.color.panel,
    ...tokens.shadow.fab,
  },
  settingsBtn: {
    paddingHorizontal: tokens.space[2],
    paddingVertical: tokens.space[1],
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.sidebar,
  },
  settingsBtnPressed: { opacity: 0.85 },
});
