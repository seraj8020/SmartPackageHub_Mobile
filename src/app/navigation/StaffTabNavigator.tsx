import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StaffTabParamList } from "@/app/navigation/types";
import {
  SafeBottomTabBar,
  tabBarScreenOptions,
} from "@/app/navigation/SafeBottomTabBar";
import { StaffReceivedPackagesScreen } from "@/features/package-inbox/screens/StaffReceivedPackagesScreen";
import { StaffShelvedPackagesScreen } from "@/features/package-inbox/screens/StaffShelvedPackagesScreen";
import { StaffScanScreen } from "@/features/package-intake/screens/StaffScanScreen";
import { RunnerRouteScreen } from "@/features/package-handover/screens/RunnerRouteScreen";
import { ShelfInventoryScreen } from "@/features/shelf-management/screens/ShelfInventoryScreen";
import { StaffDoneScreen, StaffHandoverScreen } from "@/features/package-handover/screens/HandoverScreens";
import { useCallback, useEffect, useState } from "react";
import { getStaffSession } from "@/features/authentication/services/sessionStorage";
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import { clearStaffSession } from "@/features/authentication/services/sessionStorage";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSocieties } from "@/shared/services/packageApi";
import { SignOutButton } from "@/shared/ui/SignOutButton";
import { colors } from "@/shared/theme/colors";

const Tab = createBottomTabNavigator<StaffTabParamList>();

export function StaffTabNavigator() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<StaffSessionState | null>(null);
  const [societyName, setSocietyName] = useState("Loading society…");

  const loadSession = useCallback(() => {
    let active = true;
    void getStaffSession().then((stored) => { if (active) setSession(stored); });
    return () => { active = false; };
  }, []);

  useEffect(() => loadSession(), [loadSession]);
  const societyId = session?.primarySocietyId ?? session?.societyIds?.[0] ?? "";

  useEffect(() => {
    let active = true;
    if (!societyId) {
      setSocietyName("No society linked");
      return () => { active = false; };
    }
    void getSocieties()
      .then((societies) => {
        if (!active) return;
        const match = societies.find((society) => society.id === societyId);
        setSocietyName(match?.name ?? `Society ${societyId.slice(0, 8)}…`);
      })
      .catch(() => {
        if (active) setSocietyName(`Society ${societyId.slice(0, 8)}…`);
      });
    return () => { active = false; };
  }, [societyId]);
  async function signOut() {
    await clearStaffSession();
    await tokenStorage.removeToken();
    resetToRoot(navigation, "Launch");
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.headerText}>
          <Text style={styles.society} numberOfLines={1}>{societyName}</Text>
          <Text style={styles.user} numberOfLines={1}>{session?.username ?? "Staff"}</Text>
        </View>
        <SignOutButton onPress={() => void signOut()} />
      </View>
      <Tab.Navigator
        tabBar={(props) => <SafeBottomTabBar {...props} />}
        screenOptions={{
          ...tabBarScreenOptions,
          tabBarLabelStyle: {
            ...tabBarScreenOptions.tabBarLabelStyle,
            fontSize: 9,
          },
        }}
      >
      <Tab.Screen
        name="Scan"
        component={StaffScanScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={StaffReceivedPackagesScreen}
        options={{
          title: "Receive",
          tabBarLabel: "Receive",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="file-tray-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Shelf"
        component={StaffShelvedPackagesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={ShelfInventoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Route"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size - 2} color={color} />
          ),
        }}
      >
        {() => <RunnerRouteScreen />}
      </Tab.Screen>
      <Tab.Screen
        name="Hand"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="hand-left-outline" size={size - 2} color={color} />
          ),
        }}
      >
        {() => <StaffHandoverScreen societyId={societyId} />}
      </Tab.Screen>
      <Tab.Screen
        name="Done"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-outline" size={size - 2} color={color} />
          ),
        }}
      >
        {() => <StaffDoneScreen societyId={societyId} />}
      </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: { flex: 1, minWidth: 0, paddingRight: 8 },
  society: { color: "#fff", fontSize: 12, fontWeight: "700" },
  user: { color: "rgba(255,255,255,0.72)", fontSize: 10, marginTop: 1 },
});
