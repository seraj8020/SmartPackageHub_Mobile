import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import { getStaffSession } from "@/features/authentication/services/sessionStorage";
import { PackageIntakeSessionProvider } from "@/features/package-intake/context/PackageIntakeSessionContext";
import type { StaffScanFlowParamList } from "@/features/package-intake/navigation/staffScanFlow.types";
import { StaffScanCameraScreen } from "@/features/package-intake/screens/StaffScanCameraScreen";
import { StaffScanDetailsScreen } from "@/features/package-intake/screens/StaffScanDetailsScreen";
import { startIntakeQueueSync } from "@/features/package-intake/services/intakeQueueSync";
import { colors } from "@/shared/theme/colors";

const ScanStack = createNativeStackNavigator<StaffScanFlowParamList>();

export function StaffScanScreen() {
  const navigation = useNavigation();
  const flowFocused = useIsFocused();
  const [session, setSession] = useState<StaffSessionState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      startIntakeQueueSync();
      void (async () => {
        const stored = await getStaffSession();
        if (!active) return;
        if (!stored) {
          resetToRoot(navigation, "StaffLogin");
          return;
        }
        setSession(stored);
      })();
      return () => {
        active = false;
      };
    }, [navigation]),
  );

  const societyId = session?.primarySocietyId ?? session?.societyIds?.[0] ?? "";
  const staffUserId = session?.userId ?? "";

  if (!session || !staffUserId) {
    return (
      <View style={styles.root}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Package Intake</Text>
        </View>
        <Text style={styles.loading}>Loading session…</Text>
      </View>
    );
  }

  return (
    <PackageIntakeSessionProvider
      societyId={societyId}
      staffUserId={staffUserId}
      username={session.username}
      flowFocused={flowFocused}
    >
      <ScanStack.Navigator
        initialRouteName="ScanCamera"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <ScanStack.Screen
          name="ScanCamera"
          component={StaffScanCameraScreen}
          options={{ title: "Scan", headerShown: false }}
        />
        <ScanStack.Screen
          name="ScanDetails"
          component={StaffScanDetailsScreen}
          options={{ title: "Package details" }}
        />
      </ScanStack.Navigator>
    </PackageIntakeSessionProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { padding: 20, color: colors.textMuted },
  titleBlock: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
