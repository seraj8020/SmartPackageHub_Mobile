import { CommonActions } from "@react-navigation/native";
import type { RootStackParamList } from "@/app/navigation/types";

type Dispatchable = {
  dispatch: (action: ReturnType<typeof CommonActions.reset>) => void;
};

/** Reset to a root stack screen from nested tab navigators. */
export function resetToRoot(
  navigation: Dispatchable,
  routeName: keyof RootStackParamList,
) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: routeName }],
    }),
  );
}
