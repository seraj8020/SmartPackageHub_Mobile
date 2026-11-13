import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { StaffTabParamList } from "@/app/navigation/types";
import {
  SafeBottomTabBar,
  tabBarScreenOptions,
} from "@/app/navigation/SafeBottomTabBar";
import { StaffReceivedPackagesScreen } from "@/features/package-inbox/screens/StaffReceivedPackagesScreen";
import { StaffShelvedPackagesScreen } from "@/features/package-inbox/screens/StaffShelvedPackagesScreen";
import { StaffScanScreen } from "@/features/package-intake/screens/StaffScanScreen";
import { StaffTabPlaceholderScreen } from "@/features/package-intake/screens/StaffTabPlaceholderScreen";
import { RunnerRouteScreen } from "@/features/package-handover/screens/RunnerRouteScreen";

const Tab = createBottomTabNavigator<StaffTabParamList>();

function Placeholder({ title, body }: { title: string; body: string }) {
  return <StaffTabPlaceholderScreen title={title} body={body} />;
}

export function StaffTabNavigator() {
  return (
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
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size - 2} color={color} />
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
            <Ionicons name="checkmark-done-outline" size={size - 2} color={color} />
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
