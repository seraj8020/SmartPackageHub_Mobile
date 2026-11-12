import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ResidentStackParamList } from "@/app/navigation/types";
import { ResidentTabNavigator } from "@/app/navigation/ResidentTabNavigator";
import { DoorDeliverySlotScreen } from "@/features/delivery-slots/screens/DoorDeliverySlotScreen";
import { colors } from "@/shared/theme/colors";

const Stack = createNativeStackNavigator<ResidentStackParamList>();

export function ResidentStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="ResidentTabs"
        component={ResidentTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryPreference"
        component={DoorDeliverySlotScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
