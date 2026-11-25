import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ResidentStackParamList } from "@/app/navigation/types";
import { ResidentHubHomeScreen } from "@/features/package-inbox/screens/ResidentHubHomeScreen";
import { ResidentHomeScreen } from "@/features/package-inbox/screens/ResidentHomeScreen";
import { ResidentPackageDetailScreen } from "@/features/package-inbox/screens/ResidentPackageDetailScreen";
import { ResidentHistoryScreen } from "@/features/package-inbox/screens/ResidentHistoryScreen";
import { ResidentProfileScreen } from "@/features/package-inbox/screens/ResidentProfileScreen";
import { DoorDeliverySlotScreen } from "@/features/delivery-slots/screens/DoorDeliverySlotScreen";
import { AuthorizeCollectorScreen } from "@/features/authorized-collector/screens/AuthorizeCollectorScreen";
import { VacationHoldScreen } from "@/features/vacation-hold/screens/VacationHoldScreen";
import { colors } from "@/shared/theme/colors";
import { hubColors } from "@/shared/ui/hub/hubTheme";

const Stack = createNativeStackNavigator<ResidentStackParamList>();

const detailScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.primary,
  headerTitleStyle: { fontWeight: "700" as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

export function ResidentStackNavigator() {
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
      <Stack.Screen name="Home" component={ResidentHubHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Packages"
        component={ResidentHomeScreen}
        options={{ ...detailScreenOptions, title: "My packages" }}
      />
      <Stack.Screen name="PackageDetail" component={ResidentPackageDetailScreen} options={{ ...detailScreenOptions, title: "Package detail" }} />
      <Stack.Screen
        name="AuthorizeCollector"
        component={AuthorizeCollectorScreen}
        options={{ ...detailScreenOptions, title: "Authorize collector", headerBackTitle: "Package" }}
      />
      <Stack.Screen name="History" component={ResidentHistoryScreen} options={{ ...detailScreenOptions, title: "History" }} />
      <Stack.Screen
        name="Vacation"
        component={VacationHoldScreen}
        options={{ ...detailScreenOptions, headerShown: false, title: "Vacation" }}
      />
      <Stack.Screen name="Profile" component={ResidentProfileScreen} options={{ ...detailScreenOptions, title: "Profile" }} />
      <Stack.Screen
        name="DeliveryPreference"
        component={DoorDeliverySlotScreen}
        options={{ ...detailScreenOptions, title: "Delivery preference", headerBackTitle: "Package" }}
      />
    </Stack.Navigator>
  );
}
