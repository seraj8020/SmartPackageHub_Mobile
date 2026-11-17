import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { ResidentTabParamList } from "@/app/navigation/types";
import {
  SafeBottomTabBar,
  tabBarScreenOptions,
} from "@/app/navigation/SafeBottomTabBar";
import { ResidentHomeScreen } from "@/features/package-inbox/screens/ResidentHomeScreen";
import { ResidentHistoryScreen } from "@/features/package-inbox/screens/ResidentHistoryScreen";
import { ResidentPlaceholderScreen } from "@/features/package-inbox/screens/ResidentPlaceholderScreen";

const Tab = createBottomTabNavigator<ResidentTabParamList>();

function VacationScreen() {
  return (
    <ResidentPlaceholderScreen
      title="Vacation hold"
      body="Pause door delivery while you are away (same Vacation tab as web)."
    />
  );
}

function ProfileScreen() {
  return (
    <ResidentPlaceholderScreen
      title="Profile"
      body="Resident profile and preferences will appear here (same Profile tab as web)."
    />
  );
}

export function ResidentTabNavigator() {
  return (
    <Tab.Navigator
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
        component={VacationScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size - 2} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
