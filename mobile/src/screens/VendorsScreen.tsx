import { createApi } from "@/data/api/client";
import { CardContainer } from "@/components/ui/CardContainer";
import { InputField } from "@/components/ui/InputField";
import { ListItem } from "@/components/ui/ListItem";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import { useFocusEffect, useNavigation, type NavigationProp } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

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
    setSheetOpen(true);
  }

  function openEditSheet(v: Vendor) {
    setEditingVendorId(v.id);
    setName(v.name ?? "");
    setPhone(v.phone ?? "");
    setAlternatePhone(v.alternatePhone ?? "");
    setGstNumber(v.gstNumber ?? "");
    setStatus(null);
    setSheetOpen(true);
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
      <FlatList
        removeClippedSubviews={false}
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
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
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.name}
            subtitle={`Phone ${item.phone ?? "-"} • Alt ${item.alternatePhone ?? "-"}\nGST ${item.gstNumber ?? "-"}`}
            amountLabel={`Pending ${item.totals.pending}`}
            rightSlot={
              <View style={styles.rightWrap}>
                <Text style={styles.positive}>Paid {item.totals.paid}</Text>
                <Pressable style={styles.editBtn} onPress={() => openEditSheet(item)} hitSlop={8}>
                  <Text style={styles.editIcon}>✎</Text>
                </Pressable>
              </View>
            }
            onPress={() => navigation.navigate("VendorDetails", { id: item.id })}
            showChevron
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>{listError ? "Unable to load vendors" : "No vendors"}</Text>}
      />

      <Pressable style={styles.fab} onPress={openAddSheet} hitSlop={8}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

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
            <Text style={styles.formTitle}>{editingVendorId ? "Edit vendor" : "Add vendor"}</Text>
            <InputField label="Vendor name" placeholder="Enter vendor name" value={name} onChangeText={setName} />
            <InputField label="Phone" placeholder="Enter phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <InputField
              label="Alternate phone"
              placeholder="Enter alternate phone"
              value={alternatePhone}
              onChangeText={setAlternatePhone}
              keyboardType="phone-pad"
            />
            <InputField label="GST number" placeholder="Enter GST number" value={gstNumber} onChangeText={setGstNumber} />
            <PrimaryButton
              title={editingVendorId ? "Update vendor" : "Add vendor"}
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
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 96,
    gap: 12,
    backgroundColor: tokens.color.background,
  },
  form: {},
  formTitle: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: tokens.color.text, marginBottom: 8 },
  meta: { fontSize: 13, color: tokens.color.muted },
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
  fab: {
    position: "absolute",
    right: tokens.space[2],
    bottom: tokens.space[3],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.color.accent,
    alignItems: "center",
    justifyContent: "center",
    ...tokens.shadow.fab,
  },
  fabText: { color: tokens.color.onAccent, fontSize: 30, lineHeight: 32, fontWeight: "600" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 24,
    maxHeight: "85%",
  },
});
