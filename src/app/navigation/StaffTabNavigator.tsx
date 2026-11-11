import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { StaffTabParamList } from "@/app/navigation/types";
import { StaffScanPlaceholderScreen } from "@/features/package-intake/screens/StaffScanPlaceholderScreen";
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
        component={StaffScanPlaceholderScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Inbox"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="file-tray-outline" size={size - 4} color={color} />
          ),
        }}
      >
        {() => (
          <Placeholder
            title="Inbox"
            body="Received packages waiting for shelf assign (same Inbox tab as web)."
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Shelf"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size - 4} color={color} />
          ),
        }}
      >
        {() => (
          <Placeholder
            title="Shelf"
            body="Shelved packages ready for dispatch (same Shelf tab as web)."
          />
        )}
      </Tab.Screen>
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
