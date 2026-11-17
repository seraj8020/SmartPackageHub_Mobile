import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/app/navigation/types";
import { resolveInitialRoute } from "@/app/navigation/resolveInitialRoute";
import { ResidentStackNavigator } from "@/app/navigation/ResidentStackNavigator";
import { StaffTabNavigator } from "@/app/navigation/StaffTabNavigator";
import { LaunchScreen } from "@/features/authentication/screens/LaunchScreen";
import { ResidentOtpLoginScreen } from "@/features/authentication/screens/ResidentOtpLoginScreen";
import { ResidentRegistrationScreen } from "@/features/authentication/screens/ResidentRegistrationScreen";
import { StaffLoginScreen } from "@/features/authentication/screens/StaffLoginScreen";
import { colors } from "@/shared/theme/colors";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState<
    keyof RootStackParamList | null
  >(null);

  useEffect(() => {
    let active = true;
    void resolveInitialRoute().then((route) => {
      if (active) setInitialRoute(route);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!initialRoute) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
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
          component={ResidentStackNavigator}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="StaffApp"
          component={StaffTabNavigator}
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
