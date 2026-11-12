import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { StaffTabParamList } from "@/app/navigation/types";
import { StaffReceivedPackagesScreen } from "@/features/package-inbox/screens/StaffReceivedPackagesScreen";
import { StaffShelvedPackagesScreen } from "@/features/package-inbox/screens/StaffShelvedPackagesScreen";
import { StaffScanScreen } from "@/features/package-intake/screens/StaffScanScreen";
import { StaffTabPlaceholderScreen } from "@/features/package-intake/screens/StaffTabPlaceholderScreen";
import { colors } from "@/shared/theme/colors";

const Tab = createBottomTabNavigator<StaffTabParamList>();

function Placeholder({ title, body }: { title: string; body: string }) {
  return <StaffTabPlaceholderScreen title={title} body={body} />;
}

export function StaffTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.95)",
          borderTopColor: "rgba(0,0,0,0.06)",
          height: 58,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 8,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.3,
        },
      }}
    >
      <Tab.Screen
        name="Scan"
        component={StaffScanScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={StaffReceivedPackagesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="file-tray-outline" size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Shelf"
        component={StaffShelvedPackagesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size - 4} color={color} />
          ),
        }}
      >
        {() => (
          <Placeholder
            title="Map"
            body="Shelf occupancy map (same Map tab as web)."
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Route"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size - 4} color={color} />
          ),
        }}
      >
        {() => (
          <Placeholder
            title="Route"
            body="Tower runner route (same Route tab as web)."
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Hand"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="hand-left-outline" size={size - 4} color={color} />
          ),
        }}
      >
        {() => (
          <Placeholder
            title="Hand"
            body="OTP handover for dispatched packages (same Hand tab as web)."
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Done"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-outline" size={size - 4} color={color} />
          ),
        }}
      >
        {() => (
          <Placeholder
            title="Done"
            body="Completed flat deliveries (same Done tab as web)."
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
