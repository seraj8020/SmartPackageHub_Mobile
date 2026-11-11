import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { ResidentTabParamList } from "@/app/navigation/types";
import { ResidentHomeScreen } from "@/features/package-inbox/screens/ResidentHomeScreen";
import { ResidentPlaceholderScreen } from "@/features/package-inbox/screens/ResidentPlaceholderScreen";
import { colors } from "@/shared/theme/colors";

const Tab = createBottomTabNavigator<ResidentTabParamList>();

function HistoryScreen() {
  return (
    <ResidentPlaceholderScreen
      title="History"
      body="Delivered and past packages will appear here (same History tab as web)."
    />
  );
}

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
          letterSpacing: 0.4,
        },
      }}
    >
      <Tab.Screen
        name="Inbox"
        component={ResidentHomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="archive-outline" size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Vacation"
        component={VacationScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size - 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size - 4} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
