import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { ResidentTabParamList } from "@/app/navigation/types";
import {
  SafeBottomTabBar,
  tabBarScreenOptions,
} from "@/app/navigation/SafeBottomTabBar";
import { ResidentHomeScreen } from "@/features/package-inbox/screens/ResidentHomeScreen";
import { ResidentHistoryScreen } from "@/features/package-inbox/screens/ResidentHistoryScreen";
import { ResidentProfileScreen } from "@/features/package-inbox/screens/ResidentProfileScreen";
import { VacationHoldScreen } from "@/features/vacation-hold/screens/VacationHoldScreen";

const Tab = createBottomTabNavigator<ResidentTabParamList>();

export function ResidentTabNavigator() {
  return (
    <Tab.Navigator
      backBehavior="history"
      tabBar={(props) => <SafeBottomTabBar {...props} />}
      screenOptions={tabBarScreenOptions}
    >
      <Tab.Screen
        name="Inbox"
        component={ResidentHomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={ResidentHistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="archive-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Vacation"
        component={VacationHoldScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ResidentProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size - 2} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
