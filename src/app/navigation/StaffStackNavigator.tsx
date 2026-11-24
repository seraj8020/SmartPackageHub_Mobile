import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { StaffStackParamList } from "@/app/navigation/types";
import { StaffHomeScreen } from "@/features/package-intake/screens/StaffHomeScreen";
import { StaffReceivedPackagesScreen } from "@/features/package-inbox/screens/StaffReceivedPackagesScreen";
import { StaffShelvedPackagesScreen } from "@/features/package-inbox/screens/StaffShelvedPackagesScreen";
import { StaffScanScreen } from "@/features/package-intake/screens/StaffScanScreen";
import { RunnerRouteScreen } from "@/features/package-handover/screens/RunnerRouteScreen";
import { ShelfInventoryScreen } from "@/features/shelf-management/screens/ShelfInventoryScreen";
import { StaffDoneScreen, StaffHandoverScreen } from "@/features/package-handover/screens/HandoverScreens";
import { useEffect, useState } from "react";
import { getStaffSession } from "@/features/authentication/services/sessionStorage";
import { colors } from "@/shared/theme/colors";
import { hubColors } from "@/shared/ui/hub/hubTheme";

const Stack = createNativeStackNavigator<StaffStackParamList>();

const detailScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.primary,
  headerTitleStyle: { fontWeight: "700" as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

function useStaffSocietyId() {
  const [societyId, setSocietyId] = useState("");
  useEffect(() => {
    let active = true;
    void getStaffSession().then((session) => {
      if (!active || !session) return;
      setSocietyId(session.primarySocietyId ?? session.societyIds[0] ?? "");
    });
    return () => {
      active = false;
    };
  }, []);
  return societyId;
}

function StaffHandoverRoute() {
  const societyId = useStaffSocietyId();
  return <StaffHandoverScreen societyId={societyId} />;
}

function StaffDoneRoute() {
  const societyId = useStaffSocietyId();
  return <StaffDoneScreen societyId={societyId} />;
}

export function StaffStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: hubColors.surface },
        headerTintColor: hubColors.text,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: hubColors.background },
      }}
    >
      <Stack.Screen name="Home" component={StaffHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Scan"
        component={StaffScanScreen}
        options={{ ...detailScreenOptions, title: "Scan", headerShown: false }}
      />
      <Stack.Screen
        name="Inbox"
        component={StaffReceivedPackagesScreen}
        options={{ ...detailScreenOptions, title: "Received" }}
      />
      <Stack.Screen
        name="Shelf"
        component={StaffShelvedPackagesScreen}
        options={{ ...detailScreenOptions, title: "On shelf" }}
      />
      <Stack.Screen name="Map" component={ShelfInventoryScreen} options={{ ...detailScreenOptions, title: "Shelf map" }} />
      <Stack.Screen name="Route" options={{ ...detailScreenOptions, title: "Out for delivery" }}>
        {() => <RunnerRouteScreen />}
      </Stack.Screen>
      <Stack.Screen name="Hand" options={{ ...detailScreenOptions, title: "Handover" }}>
        {() => <StaffHandoverRoute />}
      </Stack.Screen>
      <Stack.Screen name="Done" options={{ ...detailScreenOptions, title: "Delivered" }}>
        {() => <StaffDoneRoute />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
