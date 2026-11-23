import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/shared/theme/colors";
import {
  getSocietyDeliveredPackages,
  getSocietyDispatchedPackages,
  generatePackagePickupOtp,
  markPackageDelivered,
  type DeliveryMethod,
  type HubPackage,
} from "@/shared/services/packageApi";
import { formatUnitLabel } from "@/shared/utils/formatUnitLabel";
import { formatDisplayTimestamp } from "@/shared/utils/formatDisplayTimestamp";
import {
  DISPATCHED_PACKAGES_CACHE_TTL_MS,
  getCachedDispatchedPackages,
  isDispatchedPackagesCacheFresh,
  removeCachedDispatchedPackage,
  setCachedDispatchedPackages,
  subscribeToDispatchedPackages,
} from "@/features/package-handover/services/handoverPackageCache";
import { updateCachedStaffPackage } from "@/features/package-inbox/services/staffPackageCache";

const CARD = { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" } as const;

export function StaffHandoverScreen({ societyId }: { societyId: string }) {
  const [packages, setPackages] = useState<HubPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HubPackage | null>(null);
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const processedRefreshRef = useRef(0);

  useEffect(
    () => (societyId ? subscribeToDispatchedPackages(societyId, setPackages) : undefined),
    [societyId],
  );

  useFocusEffect(useCallback(() => {
    if (!societyId) return undefined;
    const interval = setInterval(() => {
      setReload((current) => current + 1);
    }, DISPATCHED_PACKAGES_CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, [societyId]));

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredPackages = normalizedQuery
    ? packages.filter((pkg) =>
        [
          pkg.recipientName,
          pkg.tracking,
          pkg.trackingNumber,
          pkg.flat,
          pkg.flatNumber,
        ]
          .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)),
      )
    : packages;

  useFocusEffect(useCallback(() => {
    let active = true;
    const cachedPackages = getCachedDispatchedPackages(societyId);
    if (cachedPackages) setPackages(cachedPackages);
    const forcedRefresh = reload > processedRefreshRef.current;
    const shouldFetch = forcedRefresh || !isDispatchedPackagesCacheFresh(societyId);
    if (forcedRefresh) processedRefreshRef.current = reload;
    setLoading(!cachedPackages && shouldFetch);
    setRefreshing(Boolean(cachedPackages && shouldFetch));
    setError(null);
    if (!societyId) {
      setPackages([]);
      setError("No society is associated with this staff account.");
      setLoading(false);
      return () => { active = false; };
    }
    if (!shouldFetch) {
      setLoading(false);
      setRefreshing(false);
      return () => { active = false; };
    }
    void getSocietyDispatchedPackages(societyId)
      .then((rows) => {
        const fetchedRows = rows.filter(
          (pkg) => pkg.status?.trim().toLowerCase() !== "delivered" && !pkg.deliveredAt,
        );
        // Keep packages just dispatched from Shelved/Runner that the API response may not include yet.
        const fetchedIds = new Set(fetchedRows.map((pkg) => pkg.id));
        const latestCache = getCachedDispatchedPackages(societyId) ?? cachedPackages ?? [];
        const pendingLocal = latestCache.filter(
          (pkg) =>
            !fetchedIds.has(pkg.id) &&
            pkg.status?.trim().toLowerCase() === "dispatched" &&
            !pkg.deliveredAt,
        );
        const dispatchedRows = [...fetchedRows, ...pendingLocal];
        setCachedDispatchedPackages(societyId, dispatchedRows);
        if (active) setPackages(dispatchedRows);
      })
      .catch((err: unknown) => {
        if (active && !cachedPackages) setError(err instanceof Error ? err.message : "Unable to load dispatched packages.");
      })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [societyId, reload]));

  const refresh = useCallback(() => { setRefreshing(true); setReload((value) => value + 1); }, []);
  const refreshAfterDelivery = useCallback((deliveredPackageId: string) => {
    const delivered =
      packages.find((pkg) => pkg.id === deliveredPackageId) ??
      getCachedDispatchedPackages(societyId)?.find((pkg) => pkg.id === deliveredPackageId);
    removeCachedDispatchedPackage(societyId, deliveredPackageId);
    if (delivered) {
      updateCachedStaffPackage(societyId, {
        ...delivered,
        status: "Delivered",
        deliveredAt: new Date().toISOString(),
      });
    }
    setSelected(null);
    setReload((value) => value + 1);
  }, [packages, societyId]);

  return selected ? (
    <HandoverForm
      pkg={selected}
      onBack={() => setSelected(null)}
      onDelivered={refreshAfterDelivery}
    />
  ) : (
    <View style={styles.root}>
      <ScreenHeader title="Dispatched packages" subtitle="Tap a package to start handover" />
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#94A3B8" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search resident, AWB, or flat number"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search handover packages by resident, AWB, or flat number"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={17} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.center} /> : error ? (
          <View style={[CARD, styles.messageCard, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
            <ActionLink label="Retry loading packages" icon="refresh-outline" onPress={refresh} />
          </View>
        ) : packages.length === 0 ? (
          <EmptyState icon="cube-outline" title="No packages awaiting handover" body="Dispatched packages for this society will appear here." />
        ) : filteredPackages.length === 0 ? (
          <EmptyState icon="search" title="No matching packages" body="Try a resident name, AWB number, or flat number." />
        ) : filteredPackages.map((pkg) => (
          <Pressable key={pkg.id} onPress={() => setSelected(pkg)} style={({ pressed }) => [CARD, styles.packageCard, pressed && styles.pressed]}>
            <View style={styles.packageInfo}>
              <View style={styles.rowBetween}>
                <Text style={styles.recipient} numberOfLines={1}>{pkg.recipientName || "Recipient"}</Text>
                <Text style={styles.unit} numberOfLines={1}>{formatUnitLabel(pkg.tower, pkg.flat)}</Text>
              </View>
              <View style={styles.courierChip}>
                <Text style={styles.courier} numberOfLines={1}>{pkg.courier}</Text>
              </View>
              <Text style={styles.tracking} numberOfLines={1}>{pkg.tracking}</Text>
              {pkg.weight ? <Text style={styles.weight}>{pkg.weight}</Text> : null}
              {pkg.deliverySlotLabel ? <Text style={[styles.slot, pkg.deliverySlotStatus === "default" ? styles.defaultSlot : styles.bookedSlot]}>
                {pkg.deliverySlotStatus === "default" ? "Default door " : "Door "}{pkg.deliverySlotLabel}
              </Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={17} color="#D1D5DB" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function HandoverForm({ pkg, onBack, onDelivered }: { pkg: HubPackage; onBack: () => void; onDelivered: (packageId: string) => void }) {
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [generatingOtp, setGeneratingOtp] = useState(false);
  const [method, setMethod] = useState<DeliveryMethod>(pkg.preferredDeliveryMethod === "CounterPickup" ? "CounterPickup" : "DoorDelivery");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const otpActionRef = useRef<"generate" | "deliver" | null>(null);

  async function openCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) { setError("Camera permission is needed to scan the pickup code."); return; }
    }
    setError(null);
    setCameraOpen(true);
  }

  function onCodeDetected(result: BarcodeScanningResult) {
    if (otpActionRef.current) return;
    // Resident QR from API: SPH|{pkgNumber}|{otp} — take the OTP segment, not pkg digits.
    const digits = extractPickupOtp(result.data);
    if (!digits) return;
    setOtp(digits);
    setCameraOpen(false);
  }

  async function generateOtp() {
    if (otpActionRef.current) return;
    otpActionRef.current = "generate";
    setGeneratingOtp(true);
    setError(null);
    setOtpNotice("");
    setGeneratedOtp("");
    setOtp("");
    setCameraOpen(false);
    try {
      const result = await generatePackagePickupOtp(pkg.id);
      setGeneratedOtp(result.pickupOtp);
      setOtp(result.pickupOtp);
      setOtpNotice(result.message ?? (result.smsQueued
        ? "SMS queued to the resident. Confirm the code below, then verify."
        : "Code created, but SMS was not queued. Share the displayed OTP with the resident."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate a new pickup code.");
    } finally {
      otpActionRef.current = null;
      setGeneratingOtp(false);
    }
  }

  async function submit() {
    if (otpActionRef.current) return;
    const token = otp.replace(/\D/g, "");
    if (!/^\d{6}$/.test(token)) { setError("Enter the complete 6-digit resident OTP."); return; }
    otpActionRef.current = "deliver";
    setBusy(true);
    setError(null);
    try {
      await markPackageDelivered(pkg.id, { token, method });
      onDelivered(pkg.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to verify OTP and deliver package.";
      setError(/invalid|expired|otp|token|code/i.test(message) ? "Invalid or expired code. The package remains in the handover list." : message);
    } finally {
      otpActionRef.current = null;
      setBusy(false);
    }
  }

  const unit = formatUnitLabel(pkg.tower, pkg.flat);
  const subtitle = [unit !== "—" ? unit : null, pkg.category !== "Parcel" ? pkg.category : null].filter(Boolean).join(" · ");

  return (
    <View style={styles.root}>
      <ScreenHeader title="Handover" subtitle={subtitle || "Ready for resident pickup"} backLabel="← All packages" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={[CARD, styles.packageSummary]}>
          <Text style={styles.summaryTracking} numberOfLines={1}>{pkg.tracking || pkg.id}</Text>
          <Text style={styles.summaryMeta}>{pkg.courier}{pkg.weight ? ` · ${pkg.weight}` : ""}</Text>
        </View>

        <View style={styles.scannerCard}>
          {cameraOpen ? (
            <>
              <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onCodeDetected} />
              <Pressable style={styles.closeCamera} onPress={() => setCameraOpen(false)}><Ionicons name="close" size={20} color="#fff" /></Pressable>
            </>
          ) : (
            <View style={styles.scanIdle}>
              <Text style={styles.scanHint}>Regenerate new OTP below if resident lost the OTP.</Text>
              {/* QR scan disabled until pickup QR is delivered to residents (WhatsApp/SMS). */}
              <Pressable
                style={[styles.scanButton, styles.scanButtonDisabled]}
                disabled
                accessibilityState={{ disabled: true }}
                accessibilityLabel="Scan resident QR (temporarily unavailable)"
              >
                <Ionicons name="camera-outline" size={14} color="rgba(255,255,255,0.65)" />
                <Text style={[styles.scanText, styles.scanTextDisabled]}>Scan resident QR</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={[CARD, styles.inputCard]}>
          <Text style={styles.fieldLabel}>PICKUP CODE</Text>
          <Pressable
            style={({ pressed }) => [styles.generateOtpButton, pressed && styles.generateOtpPressed, generatingOtp && styles.generateOtpDisabled]}
            onPress={() => void generateOtp()}
            disabled={generatingOtp || busy}
            accessibilityRole="button"
            accessibilityLabel="Generate and send a new pickup OTP"
          >
            {generatingOtp ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={15} color={colors.primary} />}
            <Text style={styles.generateOtpText}>{generatingOtp ? "Generating…" : "Generate new OTP & SMS"}</Text>
          </Pressable>
          {generatedOtp ? (
            <View style={styles.generatedOtpBox}>
              <Text style={styles.generatedOtpLabel}>NEW RESIDENT OTP</Text>
              <Text style={styles.generatedOtpValue}>{generatedOtp.replace(/(\d{3})(?=\d)/, "$1 ")}</Text>
              {otpNotice ? <Text style={styles.otpNotice}>{otpNotice}</Text> : null}
            </View>
          ) : (
            <Text style={styles.otpPrompt}>Generate a fresh 6-digit code — it is SMS’d to the resident and filled below for verify.</Text>
          )}
          <Text style={styles.enterLabel}>ENTER / CONFIRM OTP</Text>
          <TextInput
            style={styles.otpInput}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={7}
            editable={!generatingOtp && !busy}
            placeholder="000 000"
            placeholderTextColor="#9CA3AF"
            value={otp.replace(/(\d{3})(?=\d)/, "$1 ")}
            onChangeText={(value) => { setOtp(value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
          />
        </View>

        <View style={[CARD, styles.methodCard]}>
          <Text style={styles.fieldLabel}>METHOD OF DELIVERY</Text>
          {pkg.preferredDeliveryMethod ? <Text style={styles.preference}>Resident preference: <Text style={styles.preferenceStrong}>{pkg.preferredDeliveryMethod === "CounterPickup" ? "Counter pickup" : "Door delivery"}</Text>. Staff can override if plans changed.</Text> : null}
          <View style={styles.methodsRow}>
            <MethodOption label="Door delivery" selected={method === "DoorDelivery"} onPress={() => setMethod("DoorDelivery")} />
            <MethodOption label="Counter pickup" selected={method === "CounterPickup"} onPress={() => setMethod("CounterPickup")} />
          </View>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.handoverError}>{error}</Text></View> : null}
        <Pressable style={({ pressed }) => [styles.verifyButton, (busy || generatingOtp || pressed) && styles.verifyPressed]} onPress={() => void submit()} disabled={busy || generatingOtp}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyText}>Verify and mark delivered</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function MethodOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.methodOption, selected && styles.methodOptionSelected]}>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={19} color={selected ? colors.primary : "#9CA3AF"} />
      <Text style={[styles.methodText, selected && styles.methodTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function StaffDoneScreen({ societyId }: { societyId: string }) {
  const [packages, setPackages] = useState<HubPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    if (!societyId) {
      setPackages([]);
      setError("No society is associated with this staff account.");
      setLoading(false);
      return () => { active = false; };
    }
    void getSocietyDeliveredPackages(societyId)
      .then((rows) => { if (active) setPackages(rows); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load delivered packages."); })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [societyId, reload]));

  const refresh = useCallback(() => { setRefreshing(true); setReload((value) => value + 1); }, []);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Flat Delivery"
        subtitle="Packages already delivered"
      />
      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.center} /> : error ? (
          <View style={[CARD, styles.messageCard, styles.errorCard]}><Text style={styles.errorText}>{error}</Text><ActionLink label="Retry loading packages" icon="refresh-outline" onPress={refresh} /></View>
        ) : packages.length === 0 ? (
          <EmptyState icon="cube-outline" title="No delivered packages" body="Packages marked delivered will appear here." />
        ) : packages.map((pkg) => (
          <View key={pkg.id} style={[CARD, styles.deliveredCard]}>
            <View style={styles.deliveredHeader}>
              <View style={styles.packageInfo}>
                <View style={styles.rowBetween}>
                  <Text style={styles.recipient} numberOfLines={1}>{pkg.recipientName || "Recipient"}</Text>
                  <Text style={styles.unit} numberOfLines={1}>{formatUnitLabel(pkg.tower, pkg.flat)}</Text>
                </View>
                <View style={styles.courierChip}>
                  <Text style={styles.courier} numberOfLines={1}>{pkg.courier}</Text>
                </View>
                <Text style={styles.tracking} numberOfLines={1}>{pkg.tracking}</Text>
              </View>
            </View>
            <View style={styles.deliveredBadge}><Ionicons name="checkmark-circle" size={12} color="#059669" /><Text style={styles.deliveredText}>{pkg.deliveredAt ? `Delivered · ${formatDisplayTimestamp(pkg.deliveredAt)}` : "Delivered"}</Text></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Pull 6-digit pickup OTP from raw QR / pasted code (SPH|PKG|123456 or bare digits). */
function extractPickupOtp(raw: string): string {
  const trimmed = raw.trim();
  const sphParts = trimmed.split("|").map((part) => part.trim());
  if (sphParts.length >= 3 && /^SPH$/i.test(sphParts[0])) {
    const fromPayload = sphParts[sphParts.length - 1].replace(/\D/g, "");
    if (fromPayload.length >= 6) return fromPayload.slice(0, 6);
  }
  const trailing = trimmed.match(/(\d{6})\s*$/);
  if (trailing) return trailing[1];
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 6 ? digits.slice(-6) : "";
}

function ScreenHeader({ title, subtitle, backLabel, onBack }: { title: string; subtitle: string; backLabel?: string; onBack?: () => void }) {
  return <View style={styles.header}>
    {backLabel && onBack ? <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>{backLabel}</Text></Pressable> : null}
    <Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerSubtitle}>{subtitle}</Text>
  </View>;
}

function EmptyState({ icon, title, body }: { icon: "cube-outline" | "search"; title: string; body: string }) {
  return <View style={[CARD, styles.empty]}><Ionicons name={icon} size={23} color="#D1D5DB" /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{body}</Text></View>;
}

function ActionLink({ label, icon, onPress }: { label: string; icon: "refresh-outline"; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.retry}><Ionicons name={icon} size={14} color={colors.primary} /><Text style={styles.retryText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 13 },
  backButton: { alignSelf: "flex-start", paddingVertical: 1, marginBottom: 7 },
  backText: { color: "rgba(255,255,255,0.72)", fontSize: 9, fontWeight: "600" },
  headerTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  headerSubtitle: { color: "rgba(255,255,255,0.62)", fontSize: 10, marginTop: 4 },
  list: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 22, gap: 8 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 4 },
  searchInput: { flex: 1, color: colors.text, fontSize: 12, paddingVertical: 0 },
  center: { marginTop: 28 },
  packageCard: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 14, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  packageInfo: { flex: 1, minWidth: 0 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recipient: { flex: 1, minWidth: 0, color: colors.primary, fontSize: 13, fontWeight: "700" },
  unit: { flexShrink: 0, maxWidth: "42%", color: "#9CA3AF", fontSize: 10, fontFamily: "monospace", textAlign: "right" },
  courierChip: { alignSelf: "flex-start", backgroundColor: "#FFEDD5", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3, marginTop: 5 },
  courier: { color: "#7C3E00", fontSize: 9, fontWeight: "700" },
  tracking: { color: "#6B7280", fontSize: 10, fontFamily: "monospace", marginTop: 4 },
  weight: { color: "#9CA3AF", fontSize: 9, marginTop: 2 },
  slot: { alignSelf: "flex-start", overflow: "hidden", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: "700", marginTop: 5 },
  defaultSlot: { backgroundColor: "#FFFBEB", color: "#92400E" },
  bookedSlot: { backgroundColor: "#ECFDF5", color: "#065F46" },
  pressed: { opacity: 0.78 },
  messageCard: { padding: 13 },
  errorCard: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  errorText: { color: colors.danger, fontSize: 12 },
  retry: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, alignSelf: "flex-start" },
  retryText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 24 },
  emptyTitle: { color: "#4B5563", fontSize: 13, fontWeight: "700", marginTop: 8 },
  emptyText: { color: "#9CA3AF", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 4 },
  form: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 28, gap: 10 },
  packageSummary: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  summaryTracking: { color: "#1A2332", fontSize: 12, fontWeight: "700", fontFamily: "monospace" },
  summaryMeta: { color: "#6B7280", fontSize: 10, marginTop: 4 },
  scannerCard: { minHeight: 128, borderRadius: 12, overflow: "hidden", backgroundColor: "#B8D9EF", justifyContent: "center", padding: 14 },
  scanIdle: { alignItems: "center", justifyContent: "center", gap: 10 },
  scanHint: { color: "#244B69", fontSize: 11, lineHeight: 16, textAlign: "center", paddingHorizontal: 8 },
  fieldLabel: { color: "#718096", fontSize: 9, fontWeight: "700", letterSpacing: 1.1, marginBottom: 8 },
  scanButton: { minHeight: 36, borderRadius: 18, paddingHorizontal: 14, backgroundColor: "#244B69", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  scanButtonDisabled: { backgroundColor: "#7A97AB", opacity: 0.7 },
  scanText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  scanTextDisabled: { color: "rgba(255,255,255,0.75)" },
  cameraFrame: { height: 220, borderRadius: 12, overflow: "hidden", backgroundColor: "#B8D9EF" },
  closeCamera: { position: "absolute", top: 8, right: 8, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  inputCard: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  generateOtpButton: { minHeight: 40, width: "100%", borderRadius: 10, paddingHorizontal: 12, marginBottom: 10, backgroundColor: "#EEF4F8", borderWidth: 1, borderColor: "#D7E6F0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  generateOtpPressed: { opacity: 0.7 },
  generateOtpDisabled: { opacity: 0.55 },
  generateOtpText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  generatedOtpBox: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, alignItems: "center" },
  generatedOtpLabel: { color: "#15803D", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  generatedOtpValue: { color: colors.primary, fontSize: 24, fontWeight: "800", letterSpacing: 4, fontFamily: "monospace", marginTop: 4 },
  otpNotice: { color: "#166534", fontSize: 10, lineHeight: 14, marginTop: 6, textAlign: "center" },
  otpPrompt: { color: "#6B7280", fontSize: 11, lineHeight: 15, marginBottom: 10 },
  enterLabel: { color: "#718096", fontSize: 9, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  otpInput: { height: 46, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F8F7F4", textAlign: "center", color: colors.primary, fontSize: 18, fontWeight: "700", letterSpacing: 5, fontFamily: "monospace" },
  methodCard: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  preference: { color: "#6B7280", fontSize: 10, lineHeight: 15, marginBottom: 8 },
  preferenceStrong: { color: colors.primary, fontWeight: "700" },
  methodOption: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F8FAFC" },
  methodOptionSelected: { borderColor: "#93C5FD", backgroundColor: "#EFF6FF" },
  methodsRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  methodText: { color: "#374151", fontSize: 11, fontWeight: "600", flexShrink: 1 },
  methodTextSelected: { color: colors.primary },
  errorBox: { backgroundColor: "#FBE8D8", borderColor: "#F5D1B5", borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10 },
  handoverError: { color: "#9A5B2E", fontSize: 11, lineHeight: 17, fontWeight: "500" },
  verifyButton: { minHeight: 46, borderRadius: 12, backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginTop: 2 },
  verifyPressed: { opacity: 0.72 },
  verifyText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  deliveredCard: { borderColor: "#6EE7B7", padding: 12, borderRadius: 13, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  deliveredHeader: { flexDirection: "row", gap: 8, marginBottom: 8 },
  deliveredBadge: { minHeight: 34, backgroundColor: "#ECFDF5", borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8 },
  deliveredText: { color: "#059669", fontSize: 10, fontWeight: "800" },
});
