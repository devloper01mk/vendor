import { createApi } from "@/data/api/client";
import { CardContainer } from "@/components/ui/CardContainer";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import { useFocusEffect, useNavigation, type NavigationProp } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Vendor = {
  id: string;
  name: string;
  phone?: string | null;
  alternatePhone?: string | null;
  gstNumber?: string | null;
  totals: { pending: string; paid: string };
};
type RangeFilter = "ALL" | "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

function formatYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRangeQuery(filter: RangeFilter, customFrom: string, customTo: string): { from?: string; to?: string } {
  if (filter === "ALL") return {};
  if (filter === "CUSTOM") {
    return {
      from: customFrom.trim() || undefined,
      to: customTo.trim() || undefined,
    };
  }
  const now = new Date();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const start = new Date(now);
  if (filter === "TODAY") {
    // same day
  } else if (filter === "WEEK") {
    start.setDate(start.getDate() - 6);
  } else {
    start.setDate(1);
  }
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
    start.getDate(),
  ).padStart(2, "0")}`;
  return { from, to: end };
}

export function VendorsScreen() {
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<AuthedStackParamList>>();
  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pickerField, setPickerField] = useState<"from" | "to" | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const rangeLabel =
    rangeFilter === "ALL"
      ? "All"
      : rangeFilter === "TODAY"
        ? "Today"
        : rangeFilter === "WEEK"
          ? "This week"
          : rangeFilter === "MONTH"
            ? "This month"
            : "Custom";

  const loadData = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const api = createApi(() => token);
      const range = getRangeQuery(rangeFilter, customFrom, customTo);
      const data = await api.get<Vendor[]>("/vendors", range);
      setRows(data);
    } catch (error) {
      setRows([]);
      setListError(error instanceof Error ? error.message : "Could not load vendors");
    } finally {
      setLoading(false);
    }
  }, [token, rangeFilter, customFrom, customTo]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  async function onAddVendor() {
    setBusy(true);
    setStatus(null);
    try {
      const api = createApi(() => token);
      if (editingVendorId) {
        await api.patch(`/vendors/${editingVendorId}`, {
          name,
          phone: phone || undefined,
          alternatePhone: alternatePhone || undefined,
          gstNumber: gstNumber || undefined,
        });
      } else {
        await api.post("/vendors", {
          name,
          phone: phone || undefined,
          alternatePhone: alternatePhone || undefined,
          gstNumber: gstNumber || undefined,
        });
      }
      setName("");
      setPhone("");
      setAlternatePhone("");
      setGstNumber("");
      setEditingVendorId(null);
      await loadData();
      setStatus(editingVendorId ? "Vendor updated" : "Vendor added");
      setSheetOpen(false);
    } catch {
      setStatus(editingVendorId ? "Failed to update vendor" : "Failed to add vendor");
    } finally {
      setBusy(false);
    }
  }

  function openAddSheet() {
    setEditingVendorId(null);
    setName("");
    setPhone("");
    setAlternatePhone("");
    setGstNumber("");
    setStatus(null);
    setLogoName(null);
    setSheetOpen(true);
  }

  function openEditSheet(v: Vendor) {
    setEditingVendorId(v.id);
    setName(v.name ?? "");
    setPhone(v.phone ?? "");
    setAlternatePhone(v.alternatePhone ?? "");
    setGstNumber(v.gstNumber ?? "");
    setStatus(null);
    setLogoName(null);
    setSheetOpen(true);
  }

  async function onPickLogo() {
    Alert.alert("Upload Logo", "Choose image source", [
      {
        text: "Camera",
        onPress: async () => {
          const res = await launchCamera({
            mediaType: "photo",
            cameraType: "back",
            quality: 0.8,
          });
          if (res.didCancel) return;
          if (res.errorCode) {
            setStatus("Could not open camera");
            return;
          }
          const asset = res.assets?.[0];
          if (asset) {
            setLogoName(asset.fileName ?? "Camera image selected");
          }
        },
      },
      {
        text: "Gallery",
        onPress: async () => {
          const res = await launchImageLibrary({
            mediaType: "photo",
            selectionLimit: 1,
            quality: 0.8,
          });
          if (res.didCancel) return;
          if (res.errorCode) {
            setStatus("Could not open gallery");
            return;
          }
          const asset = res.assets?.[0];
          if (asset) {
            setLogoName(asset.fileName ?? "Gallery image selected");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.screenHeader,
          { paddingTop: Math.max(insets.top, tokens.space[2]) },
        ]}
      >
        <View style={styles.headerWrap}>
          <View style={styles.topRow}>
            <Pressable style={styles.topIconBtn}>
              <Text style={styles.topIcon}>☰</Text>
            </Pressable>
            <Text style={styles.topTitle}>Vendors</Text>
            <View style={styles.topRight}>
              <Pressable style={styles.topIconBtn}>
                <Text style={styles.topIcon}>◌</Text>
              </Pressable>
              <Pressable style={styles.avatar} onPress={() => navigation.navigate("Settings")}>
                <Text style={styles.avatarText}>AS</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>⌕</Text>
              <Text style={styles.searchText}>Search vendors...</Text>
            </View>
            <Pressable style={styles.addInlineBtn} onPress={openAddSheet}>
              <Text style={styles.addInlineBtnText}>+ Add Vendor</Text>
            </Pressable>
          </View>
          <View style={styles.dropdownWrap}>
            <Pressable style={styles.dropdownBtn} onPress={() => setFilterOpen((v) => !v)}>
              <Text style={styles.dropdownText}>{rangeLabel}</Text>
              <Text style={styles.dropdownIcon}>▾</Text>
            </Pressable>
          </View>
          {rangeFilter === "CUSTOM" ? (
            <View style={styles.customRow}>
              <Pressable
                style={styles.dateBtn}
                onPress={() => {
                  const existing = customFrom ? new Date(customFrom) : new Date();
                  setPickerDate(Number.isNaN(existing.getTime()) ? new Date() : existing);
                  setPickerField("from");
                }}
              >
                <Text style={styles.dateBtnText}>{customFrom || "From date"}</Text>
              </Pressable>
              <Pressable
                style={styles.dateBtn}
                onPress={() => {
                  const existing = customTo ? new Date(customTo) : new Date();
                  setPickerDate(Number.isNaN(existing.getTime()) ? new Date() : existing);
                  setPickerField("to");
                }}
              >
                <Text style={styles.dateBtnText}>{customTo || "To date"}</Text>
              </Pressable>
            </View>
          ) : null}
          {pickerField ? (
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                if (event.type === "dismissed") {
                  setPickerField(null);
                  return;
                }
                if (selectedDate) {
                  const formatted = formatYmd(selectedDate);
                  if (pickerField === "from") setCustomFrom(formatted);
                  else setCustomTo(formatted);
                }
                setPickerField(null);
              }}
            />
          ) : null}
          {listError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{listError}</Text>
              <Pressable style={styles.retryBtn} onPress={() => void loadData()}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
      <FlatList
        removeClippedSubviews={false}
        style={styles.vendorList}
        contentContainerStyle={[styles.list, styles.listContent]}
        data={rows}
        keyExtractor={(i) => i.id}
        renderItem={({ item, index }) => (
          <Pressable style={styles.vendorCard} onPress={() => navigation.navigate("VendorDetails", { id: item.id })}>
            <View style={styles.vendorIconWrap}>
              <Text style={styles.vendorIcon}>{["◨", "◧", "◩", "◪"][index % 4]}</Text>
            </View>
            <View style={styles.vendorMiddle}>
              <Text style={styles.vendorName}>{item.name}</Text>
              <Text style={styles.vendorSub}>{item.gstNumber ?? "No GST"}</Text>
              <Text style={styles.vendorSub}>{item.phone ?? "-"}</Text>
            </View>
            <View style={styles.vendorRight}>
              <Text style={styles.vendorSpendLabel}>Total Spend</Text>
              <Text style={styles.vendorSpendValue}>₹ {item.totals.paid}</Text>
              <Pressable style={styles.editBtn} onPress={() => openEditSheet(item)} hitSlop={8}>
                <Text style={styles.editIcon}>✎</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{listError ? "Unable to load vendors" : "No vendors"}</Text>}
      />

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.dropdownOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setFilterOpen(false)} />
          <View style={styles.dropdownSheet}>
            {(["ALL", "TODAY", "WEEK", "MONTH", "CUSTOM"] as const).map((f) => (
              <Pressable
                key={f}
                style={({ pressed }) => [styles.dropdownItem, pressed && styles.pressed]}
                onPress={() => {
                  setRangeFilter(f);
                  setFilterOpen(false);
                  if (f !== "CUSTOM") setPickerField(null);
                }}
              >
                <Text style={[styles.dropdownItemText, rangeFilter === f && styles.dropdownItemTextOn]}>
                  {f === "ALL"
                    ? "All"
                    : f === "TODAY"
                      ? "Today"
                      : f === "WEEK"
                        ? "This week"
                        : f === "MONTH"
                          ? "This month"
                          : "Custom"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
          <CardContainer style={styles.sheet}>
            <Text style={styles.formTitle}>{editingVendorId ? "Edit Vendor" : "Add Vendor"}</Text>
            <View style={styles.formTopRow}>
              <Pressable style={styles.uploadTile} onPress={onPickLogo}>
                <Text style={styles.uploadTileIcon}>◫</Text>
                <Text style={styles.uploadTileText}>{logoName ? "Logo Selected" : "Upload Logo"}</Text>
                {logoName ? <Text style={styles.uploadTileFile}>{logoName}</Text> : null}
              </Pressable>
              <View style={styles.formFields}>
                <InputField label="Vendor Name" placeholder="Enter vendor name" value={name} onChangeText={setName} />
                <InputField label="GST Number" placeholder="Enter GST number" value={gstNumber} onChangeText={setGstNumber} />
                <InputField label="Phone" placeholder="Enter phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                <InputField
                  label="Alternate Phone"
                  placeholder="Enter alternate phone"
                  value={alternatePhone}
                  onChangeText={setAlternatePhone}
                />
              </View>
            </View>
            <PrimaryButton
              title={editingVendorId ? "Save Vendor" : "Save Vendor"}
              onPress={onAddVendor}
              disabled={busy || !name.trim()}
              loading={busy}
            />
            {status ? <Text style={styles.meta}>{status}</Text> : null}
          </CardContainer>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  center: { flex: 1, justifyContent: "center" },
  screenHeader: { paddingHorizontal: 16, backgroundColor: tokens.color.background },
  vendorList: { flex: 1 },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 96,
    gap: 12,
    backgroundColor: tokens.color.background,
  },
  listContent: { flexGrow: 1 },
  form: {},
  formTitle: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: tokens.color.text, marginBottom: 8 },
  meta: { fontSize: 13, color: tokens.color.muted },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  topIcon: { fontSize: 16, color: tokens.color.text },
  topTitle: { flex: 1, marginLeft: 8, fontSize: tokens.textSize.title, color: tokens.color.text, fontWeight: "600" },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EDE4D6", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, color: "#5F5342", fontWeight: "600" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: tokens.space[1] },
  searchBox: {
    flex: 1,
    height: 42,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  searchIcon: { color: tokens.color.muted, marginRight: 8 },
  searchText: { color: "#A0927B", fontSize: 12 },
  addInlineBtn: {
    height: 42,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.accent,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addInlineBtnText: { fontSize: 12, color: tokens.color.onAccent, fontWeight: "600" },
  positive: { fontSize: 13, color: tokens.color.positive, fontWeight: "600" },
  rightWrap: { alignItems: "flex-end", gap: 8 },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.panelMuted,
  },
  editIcon: { fontSize: 14, color: tokens.color.text },
  empty: { textAlign: "center", color: tokens.color.muted, marginTop: 40 },
  errorBanner: {
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.negativeMuted,
    backgroundColor: tokens.color.negativeMuted,
    padding: tokens.space[2],
    marginBottom: tokens.space[1],
    gap: tokens.space[1],
  },
  headerWrap: { gap: tokens.space[1] },
  dropdownWrap: {
    alignSelf: "flex-end",
    width: 170,
    position: "relative",
    zIndex: 20,
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 10,
  },
  dropdownText: { color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
  dropdownIcon: { color: tokens.color.muted, fontSize: 14 },
  dropdownOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: tokens.space[2],
  },
  dropdownSheet: {
    width: 170,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    overflow: "hidden",
    elevation: 4,
  },
  dropdownItem: { paddingHorizontal: tokens.space[2], paddingVertical: 10 },
  dropdownItemText: { color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
  dropdownItemTextOn: { color: tokens.color.accent },
  pressed: { opacity: 0.88 },
  customRow: { flexDirection: "row", gap: tokens.space[1] },
  dateBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 10,
  },
  dateBtnText: { color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
  errorText: {
    color: tokens.color.negative,
    fontSize: tokens.textSize.caption,
    lineHeight: 18,
    fontWeight: "600",
  },
  retryBtn: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 8,
    backgroundColor: tokens.color.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  retryBtnText: {
    color: tokens.color.text,
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
  },
  vendorCard: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.panel,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  vendorIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F4EFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  vendorIcon: { fontSize: 13, color: "#7F725A", fontWeight: "700" },
  vendorMiddle: { flex: 1 },
  vendorName: { fontSize: 14, fontWeight: "600", color: tokens.color.text },
  vendorSub: { marginTop: 2, fontSize: 11, color: tokens.color.muted },
  vendorRight: { alignItems: "flex-end", gap: 4 },
  vendorSpendLabel: { fontSize: 10, color: tokens.color.muted },
  vendorSpendValue: { fontSize: 16, color: tokens.color.text, fontWeight: "700" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 24,
    maxHeight: "85%",
  },
  formTopRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 8 },
  uploadTile: {
    width: 82,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.panelMuted,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  uploadTileIcon: { fontSize: 18, color: "#8A7E68", marginBottom: 6 },
  uploadTileText: { fontSize: 10, color: tokens.color.muted, fontWeight: "600", textAlign: "center" },
  uploadTileFile: {
    marginTop: 4,
    fontSize: 9,
    color: tokens.color.text,
    fontWeight: "500",
    textAlign: "center",
  },
  formFields: { flex: 1 },
});
