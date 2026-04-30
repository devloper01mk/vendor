import { createApi } from "@/data/api/client";
import { ApiError } from "@/data/api/client";
import { CardContainer } from "@/components/ui/CardContainer";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@react-native-vector-icons/ionicons";
import DocumentPicker from "react-native-document-picker";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { config } from "@/core/config";

type Tx = {
  id: string;
  itemName: string;
  totalAmount: string;
  paidTotal: string;
  remaining: string;
  entryDate: string;
  isFlagged: boolean;
  vendor: { name: string };
  site: { name: string };
  createdBy: { id: string };
  uiType?: "RECEIVED" | "SENT" | "PENDING";
};

type ListResp = {
  items: Tx[];
};

type Nav = NativeStackNavigationProp<AuthedStackParamList>;
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

function shortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function TransactionsScreen() {
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pickerField, setPickerField] = useState<"from" | "to" | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<"ALL" | "RECEIVED" | "SENT" | "PENDING">("ALL");
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
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
  const topRows = useMemo(() => rows.slice(0, 24), [rows]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const api = createApi(() => token);
        const range = getRangeQuery(rangeFilter, customFrom, customTo);
        const data = await api.get<ListResp>("/requirements", {
          page: "1",
          limit: "100",
          flow: typeFilter,
          ...range,
        });
        if (!cancelled) setRows(data.items);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) {
          setErr(`${e.message || "Request failed"} (HTTP ${e.status})`);
        } else if (e instanceof Error) {
          setErr(e.message);
        } else {
          setErr("Could not load transactions");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, rangeFilter, customFrom, customTo, typeFilter]);

  useFocusEffect(load);

  const handleImport = useCallback(async () => {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in again.");
      return;
    }
    try {
      const file = await DocumentPicker.pickSingle({
        type: [
          "text/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          DocumentPicker.types.plainText,
          DocumentPicker.types.allFiles,
        ],
      });
      if (!file.uri) {
        Alert.alert("Invalid file", "Please pick a valid spreadsheet file.");
        return;
      }
      setImporting(true);
      const form = new FormData();
      form.append("file", {
        uri: file.uri,
        name: file.name || "transactions-import.xlsx",
        type:
          file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      } as never);

      const res = await fetch(`${config.apiUrl}/import/spreadsheet`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "x-client-platform": "mobile",
        },
        body: form,
      });
      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      if (!res.ok) {
        const message = typeof payload?.message === "string" ? payload.message : "Import failed";
        Alert.alert("Import failed", message);
        return;
      }
      const imported = Number(payload?.imported || 0);
      const errorCount = Array.isArray(payload?.errors) ? payload.errors.length : 0;
      Alert.alert("Import completed", `Imported: ${imported}\nRow errors: ${errorCount}`);
      load();
    } catch (error) {
      if (DocumentPicker.isCancel(error)) return;
      Alert.alert("Import failed", "Unable to import file.");
    } finally {
      setImporting(false);
    }
  }, [token, load]);

  const handleExport = useCallback(async () => {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in again.");
      return;
    }
    setExporting(true);
    try {
      const url = `${config.apiUrl}/import/spreadsheet/export?accessToken=${encodeURIComponent(token)}`;
      await Linking.openURL(url);
      Alert.alert("Export started", "Download opened in browser.");
    } catch {
      Alert.alert("Export failed", "Unable to start export.");
    } finally {
      setExporting(false);
    }
  }, [token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.color.accent} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        removeClippedSubviews={false}
        contentContainerStyle={[
          styles.list,
          { paddingTop: Math.max(insets.top, tokens.space[2]), paddingBottom: tokens.space[5] + 24 },
        ]}
        data={topRows}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View style={styles.head}>
            <View style={styles.topRow}>
              <Pressable style={styles.topIconBtn}>
                <Ionicons name="menu-outline" size={18} color={tokens.color.text} />
              </Pressable>
              <Text style={styles.topTitle}>Transactions</Text>
              <View style={styles.topRight}>
                <Pressable style={styles.topIconBtn}>
                  <Ionicons name="notifications-outline" size={16} color={tokens.color.text} />
                </Pressable>
                <Pressable style={styles.avatar} onPress={() => navigation.navigate("Settings")}>
                  <Text style={styles.avatarText}>AS</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={15} color={tokens.color.muted} />
                <Text style={styles.searchText}>Search transactions...</Text>
              </View>
              <Pressable style={styles.filterBtn}>
                <Ionicons name="options-outline" size={14} color={tokens.color.text} />
              </Pressable>
            </View>

            {err ? (
              <CardContainer style={styles.banner}>
                <Text style={styles.bannerTitle}>Could not load</Text>
                <Text style={styles.bannerMsg}>{err}</Text>
              </CardContainer>
            ) : null}

            <View style={styles.tabRow}>
              <Pressable style={styles.typeDropdownBtn} onPress={() => setTypeFilterOpen(true)}>
                <View style={styles.typeLeftWrap}>
                  <Ionicons name="ellipse-outline" size={12} color="#8A7E68" />
                  <Text style={styles.typeDropdownText}>
                    {typeFilter === "ALL"
                      ? "All"
                      : typeFilter === "RECEIVED"
                        ? "Received"
                        : typeFilter === "SENT"
                          ? "Sent"
                          : "Pending"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={13} color={tokens.color.muted} />
              </Pressable>
              <Pressable style={styles.calendarDropdownBtn} onPress={() => setFilterOpen((v) => !v)}>
                <Ionicons name="calendar-outline" size={12} color="#8A7E68" />
                <Text style={styles.calendarDropdownText}>{rangeLabel}</Text>
                <Ionicons name="chevron-down" size={13} color={tokens.color.muted} />
              </Pressable>
              <Pressable style={styles.actionIconBtn} onPress={handleImport} disabled={importing || exporting}>
                {importing ? (
                  <ActivityIndicator size="small" color={tokens.color.accent} />
                ) : (
                  <Ionicons name="download-outline" size={15} color="#5F5342" />
                )}
              </Pressable>
              <Pressable style={styles.actionIconBtn} onPress={handleExport} disabled={importing || exporting}>
                {exporting ? (
                  <ActivityIndicator size="small" color={tokens.color.accent} />
                ) : (
                  <Ionicons name="share-outline" size={15} color="#5F5342" />
                )}
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
          </View>
        }
        renderItem={({ item }) => {
          const kind = item.uiType ?? "PENDING";
          const inbound = kind === "RECEIVED";
          const amountValue =
            kind === "RECEIVED" ? item.paidTotal : kind === "SENT" ? item.paidTotal : item.remaining;
          return (
            <Pressable style={styles.txCard} onPress={() => navigation.navigate("Payment", { id: item.id })}>
              <View style={styles.txIconWrap}>
                {inbound ? (
                  <Ionicons name="arrow-down-outline" size={14} color="#2E7E59" />
                ) : (
                  <Ionicons name="arrow-up-outline" size={14} color="#B55050" />
                )}
              </View>
              <View style={styles.txMiddle}>
                <Text style={styles.txTitle} numberOfLines={1}>
                  {inbound ? "From " : "To "} {item.vendor.name}
                </Text>
                <Text style={styles.txMeta}>Brand/Person</Text>
                <Text style={styles.txMeta}>{shortDate(item.entryDate)}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, inbound ? styles.positive : styles.negative]}>
                  {inbound ? "+" : "-"}
                  {amountValue}
                </Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{kind === "PENDING" ? "Pending" : "Completed"}</Text>
                </View>
                {me?.id && item.createdBy?.id === me.id ? (
                  <Pressable
                    style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
                    onPress={() => navigation.navigate("EditEntry", { id: item.id })}
                    hitSlop={8}
                  >
                    <Ionicons name="pencil-outline" size={12} color={tokens.color.text} />
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>{err ? "—" : "No transactions yet. Tap + to add one."}</Text>
        }
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
      <Modal visible={typeFilterOpen} transparent animationType="fade" onRequestClose={() => setTypeFilterOpen(false)}>
        <View style={styles.dropdownOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setTypeFilterOpen(false)} />
          <View style={styles.dropdownSheet}>
            {(["ALL", "RECEIVED", "SENT", "PENDING"] as const).map((f) => (
              <Pressable
                key={f}
                style={({ pressed }) => [styles.dropdownItem, pressed && styles.pressed]}
                onPress={() => {
                  setTypeFilter(f);
                  setTypeFilterOpen(false);
                }}
              >
                <Text style={[styles.dropdownItemText, typeFilter === f && styles.dropdownItemTextOn]}>
                  {f === "ALL" ? "All" : f === "RECEIVED" ? "Received" : f === "SENT" ? "Sent" : "Pending"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", backgroundColor: tokens.color.background },
  wrap: { flex: 1, backgroundColor: tokens.color.background },
  list: { paddingHorizontal: tokens.space[2], gap: tokens.space[2] },
  head: { gap: tokens.space[2], marginBottom: tokens.space[1] },
  kicker: {
    fontSize: tokens.textSize.caption,
    fontWeight: "700",
    color: tokens.color.accent,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  screenTitle: {
    fontSize: tokens.textSize.hero,
    fontWeight: "700",
    color: tokens.color.text,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  screenSub: { fontSize: tokens.textSize.small, color: tokens.color.muted, fontWeight: "500" },
  banner: { gap: tokens.space[1], borderColor: tokens.color.negativeMuted, backgroundColor: tokens.color.negativeMuted },
  bannerTitle: { color: tokens.color.negative, fontWeight: "700", fontSize: tokens.textSize.small },
  bannerMsg: { color: tokens.color.muted, fontSize: tokens.textSize.caption, lineHeight: 18 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
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
  searchText: { color: "#A0927B", fontSize: 12 },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  typeDropdownBtn: {
    height: 36,
    flex: 1,
    borderRadius: tokens.radius.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: tokens.color.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeLeftWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeDropdownText: { fontSize: 12, color: "#5F5342", fontWeight: "600" },
  calendarDropdownBtn: {
    height: 36,
    minWidth: 126,
    borderRadius: tokens.radius.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: tokens.color.border,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  calendarDropdownText: { flex: 1, fontSize: 12, color: "#5F5342", fontWeight: "600" },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  positive: { color: tokens.color.positive },
  negative: { color: tokens.color.negative },
  dropdownWrap: {
    marginTop: tokens.space[1],
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
    paddingTop: 150,
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
  customRow: { flexDirection: "row", gap: tokens.space[1], marginTop: tokens.space[1] },
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
  editBtn: {
    width: 24,
    height: 24,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.panelMuted,
  },
  editBtnPressed: { opacity: 0.85, backgroundColor: tokens.color.border },
  txCard: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.panel,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  txIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4EFE7",
  },
  txMiddle: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: "600", color: tokens.color.text },
  txMeta: { fontSize: 11, color: tokens.color.muted, marginTop: 2 },
  txRight: { alignItems: "flex-end", gap: 6 },
  txAmount: { fontSize: 20, fontWeight: "700" },
  statusPill: {
    borderRadius: 10,
    backgroundColor: "#EAF5EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 10, color: "#2E7E59", fontWeight: "600" },
  empty: { textAlign: "center", color: tokens.color.muted, marginTop: tokens.space[4], fontSize: tokens.textSize.small, lineHeight: 20 },
});
