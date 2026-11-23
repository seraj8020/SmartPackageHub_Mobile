import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ResidentStackParamList } from "@/app/navigation/types";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import type { ResidentSessionState } from "@/features/authentication/models/auth.types";
import {
  clearResidentSession,
  getResidentSession,
} from "@/features/authentication/services/sessionStorage";
import { getResidentPackages, getSocieties, type HubPackage } from "@/shared/services/packageApi";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { HubHomeLayout, HubTile, HubTileRow } from "@/shared/ui/hub/HubHomeLayout";
import { hubColors } from "@/shared/ui/hub/hubTheme";
import { firstNameFrom, greetingForNow } from "@/shared/utils/greeting";

type Nav = NativeStackNavigationProp<ResidentStackParamList, "Home">;

export function ResidentHubHomeScreen() {
  const navigation = useNavigation<Nav>();
  const [session, setSession] = useState<ResidentSessionState | null>(null);
  const [societyName, setSocietyName] = useState("");
  const [packages, setPackages] = useState<HubPackage[]>([]);

  useEffect(() => {
    let active = true;
    void getResidentSession().then((stored) => {
      if (!active) return;
      if (!stored) {
        resetToRoot(navigation, "ResidentLogin");
        return;
      }
      setSession(stored);
    });
    return () => {
      active = false;
    };
  }, [navigation]);

  useEffect(() => {
    if (!session?.societyId) return;
    let active = true;
    void getSocieties()
      .then((rows) => {
        if (!active) return;
        setSocietyName(rows.find((s) => s.id === session.societyId)?.name ?? "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session?.societyId]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.residentId) return;
      let active = true;
      void getResidentPackages(session.residentId)
        .then((rows) => {
          if (active) setPackages(rows);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [session?.residentId]),
  );

  const awaitingCount = useMemo(
    () =>
      packages.filter((pkg) => {
        const status = pkg.status ?? "Shelved";
        return status === "Shelved" || status === "Dispatched";
      }).length,
    [packages],
  );

  const pendingCodCount = useMemo(
    () =>
      packages.filter(
        (pkg) =>
          pkg.isCod &&
          pkg.codApprovalStatus === "Pending" &&
          (pkg.status ?? "Received") === "Received",
      ).length,
    [packages],
  );

  const greeting = `${greetingForNow()}, ${firstNameFrom(session?.fullName ?? "there")}`;

  async function signOut() {
    await clearResidentSession();
    await tokenStorage.removeToken();
    resetToRoot(navigation, "Launch");
  }

  function openSettings() {
    Alert.alert(session?.fullName ?? "Resident", societyName || "SPH", [
      { text: "Profile", onPress: () => navigation.navigate("Profile") },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <HubHomeLayout
      brand="SPH"
      subtitle={societyName || "Resident"}
      onSettings={openSettings}
    >
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.flowHint}>Your packages · home</Text>

      <HubTileRow>
        <HubTile
          title="My packages"
          subtitle="Waiting at hub"
          icon="cube-outline"
          count={awaitingCount}
          onPress={() => navigation.navigate("Packages")}
        />
        <HubTile
          title="History"
          subtitle="Past deliveries"
          icon="archive-outline"
          onPress={() => navigation.navigate("History")}
        />
      </HubTileRow>

      <HubTileRow>
        <HubTile
          title="Vacation"
          subtitle="Pause door delivery"
          icon="calendar-outline"
          onPress={() => navigation.navigate("Vacation")}
        />
        <HubTile
          title="Profile"
          subtitle="Flat · phone"
          icon="person-outline"
          onPress={() => navigation.navigate("Profile")}
        />
      </HubTileRow>

      {pendingCodCount > 0 ? (
        <HubTile
          wide
          title="COD approvals"
          subtitle={`${pendingCodCount} waiting for your OK`}
          icon="cash-outline"
          count={pendingCodCount}
          onPress={() => navigation.navigate("Packages")}
        />
      ) : null}

      <HubTile
        hero
        title="Open inbox"
        subtitle="See what’s ready for you"
        icon="mail-open-outline"
        count={awaitingCount > 0 ? awaitingCount : undefined}
        onPress={() => navigation.navigate("Packages")}
      />
    </HubHomeLayout>
  );
}

const styles = StyleSheet.create({
  greeting: {
    color: hubColors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  flowHint: {
    color: hubColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
});
