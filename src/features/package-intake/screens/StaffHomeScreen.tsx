import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StaffStackParamList } from "@/app/navigation/types";
import { resetToRoot } from "@/app/navigation/navigationHelpers";
import type { StaffSessionState } from "@/features/authentication/models/auth.types";
import {
  clearStaffSession,
  getStaffSession,
} from "@/features/authentication/services/sessionStorage";
import {
  clearStaffPackagesCache,
  getCachedStaffPackages,
  setCachedStaffPackages,
  subscribeToStaffPackages,
} from "@/features/package-inbox/services/staffPackageCache";
import { invalidateDispatchedPackagesCache } from "@/features/package-handover/services/handoverPackageCache";
import { getSocieties, getSocietyPackages, type HubPackage } from "@/shared/services/packageApi";
import { tokenStorage } from "@/shared/services/tokenStorage";
import { HubHomeLayout, HubTile, HubTileRow } from "@/shared/ui/hub/HubHomeLayout";
import { hubColors } from "@/shared/ui/hub/hubTheme";

type Nav = NativeStackNavigationProp<StaffStackParamList, "Home">;

function countByStatus(packages: HubPackage[], status: string) {
  return packages.filter((pkg) => (pkg.status ?? "") === status).length;
}

export function StaffHomeScreen() {
  const navigation = useNavigation<Nav>();
  const [session, setSession] = useState<StaffSessionState | null>(null);
  const [societyName, setSocietyName] = useState("Your society");
  const [packages, setPackages] = useState<HubPackage[]>([]);

  const societyId = session?.primarySocietyId ?? session?.societyIds?.[0] ?? "";

  const loadSession = useCallback(() => {
    let active = true;
    void getStaffSession().then((stored) => {
      if (!active) return;
      if (!stored) {
        resetToRoot(navigation, "StaffLogin");
        return;
      }
      setSession(stored);
    });
    return () => {
      active = false;
    };
  }, [navigation]);

  useEffect(() => loadSession(), [loadSession]);

  useEffect(() => {
    if (!societyId) return;
    let active = true;
    void getSocieties()
      .then((societies) => {
        if (!active) return;
        const match = societies.find((s) => s.id === societyId);
        setSocietyName(match?.name ?? "Society");
      })
      .catch(() => {
        if (active) setSocietyName("Society");
      });
    return () => {
      active = false;
    };
  }, [societyId]);

  useFocusEffect(
    useCallback(() => {
      if (!societyId) return;
      const cached = getCachedStaffPackages(societyId);
      if (cached) setPackages(cached);
      const unsubscribe = subscribeToStaffPackages(societyId, setPackages);
      let active = true;
      void getSocietyPackages(societyId)
        .then((rows) => {
          if (!active) return;
          setCachedStaffPackages(societyId, rows);
          setPackages(rows);
        })
        .catch(() => undefined);
      return () => {
        active = false;
        unsubscribe();
      };
    }, [societyId]),
  );

  const receivedCount = useMemo(() => countByStatus(packages, "Received"), [packages]);
  const shelvedCount = useMemo(() => countByStatus(packages, "Shelved"), [packages]);
  const dispatchedCount = useMemo(() => countByStatus(packages, "Dispatched"), [packages]);
  const deliveredCount = useMemo(() => countByStatus(packages, "Delivered"), [packages]);

  async function signOut() {
    for (const id of new Set(session?.societyIds ?? [societyId])) {
      if (id) {
        clearStaffPackagesCache(id);
        invalidateDispatchedPackagesCache(id);
      }
    }
    await clearStaffSession();
    await tokenStorage.removeToken();
    resetToRoot(navigation, "Launch");
  }

  function openSettings() {
    Alert.alert(session?.username ?? "Staff", societyName, [
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <HubHomeLayout brand="SPH" subtitle={societyName} onSettings={openSettings}>
      <Text style={styles.flowHint}>Residential hub · inbound flow</Text>

      <HubTileRow>
        <HubTile
          title="Received"
          subtitle="Just arrived"
          icon="file-tray-outline"
          count={receivedCount}
          onPress={() => navigation.navigate("Inbox")}
        />
        <HubTile
          title="On shelf"
          subtitle="Ready for door"
          icon="cube-outline"
          count={shelvedCount}
          onPress={() => navigation.navigate("Shelf")}
        />
      </HubTileRow>

      <HubTileRow>
        <HubTile
          title="Out for delivery"
          subtitle="Runner route"
          icon="map-outline"
          count={dispatchedCount}
          onPress={() => navigation.navigate("Route")}
        />
        <HubTile
          title="Handover"
          subtitle="OTP / POD"
          icon="hand-left-outline"
          onPress={() => navigation.navigate("Hand")}
        />
      </HubTileRow>

      <HubTile
        wide
        title="Shelf map"
        subtitle="Find bay · tower · flat"
        icon="grid-outline"
        onPress={() => navigation.navigate("Map")}
      />

      <HubTile
        wide
        title="Delivered today"
        subtitle="Completed handovers"
        icon="checkmark-done-outline"
        count={deliveredCount}
        onPress={() => navigation.navigate("Done")}
      />

      <HubTile
        hero
        title="Scan"
        subtitle="Receive · shelf · match resident"
        icon="qr-code-outline"
        onPress={() => navigation.navigate("Scan")}
      />

      <View style={styles.footerNote}>
        <Text style={styles.footerText}>
          {session?.username ? `Signed in as ${session.username}` : "Staff"}
        </Text>
      </View>
    </HubHomeLayout>
  );
}

const styles = StyleSheet.create({
  flowHint: {
    color: hubColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  footerNote: {
    marginTop: 4,
    alignItems: "center",
  },
  footerText: {
    color: hubColors.textMuted,
    fontSize: 11,
  },
});
