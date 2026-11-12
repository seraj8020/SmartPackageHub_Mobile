import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/app/navigation/types";
import { ResidentTabNavigator } from "@/app/navigation/ResidentTabNavigator";
import { StaffTabNavigator } from "@/app/navigation/StaffTabNavigator";
import { LaunchScreen } from "@/features/authentication/screens/LaunchScreen";
import { ResidentOtpLoginScreen } from "@/features/authentication/screens/ResidentOtpLoginScreen";
import { ResidentRegistrationScreen } from "@/features/authentication/screens/ResidentRegistrationScreen";
import { StaffLoginScreen } from "@/features/authentication/screens/StaffLoginScreen";
import { colors } from "@/shared/theme/colors";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Launch"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Launch"
          component={LaunchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ResidentLogin"
          component={ResidentOtpLoginScreen}
          options={{ title: "Resident" }}
        />
        <Stack.Screen
          name="ResidentRegister"
          component={ResidentRegistrationScreen}
          options={{ title: "Register" }}
        />
        <Stack.Screen
          name="StaffLogin"
          component={StaffLoginScreen}
          options={{ title: "Staff" }}
        />
        <Stack.Screen
          name="ResidentApp"
          component={ResidentTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StaffApp"
          component={StaffTabNavigator}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
