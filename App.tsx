import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { RootNavigator } from "@/app/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
