import { createApi, ApiError } from "@/data/api/client";
import { formatRupee, formatRupeeWithSign } from "@/core/formatRupee";
import { CardContainer } from "@/components/ui/CardContainer";
import { ScreenChrome } from "@/components/ui/ScreenChrome";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@react-native-vector-icons/ionicons";
import DocumentPicker from "react-native-document-picker";
import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { config } from "@/core/config";

type Tx = {
  id: string;
  itemName: string;
  totalAmount: string;
  paidTotal: string;
  remaining: string;
  entryDate: string;
  createdAt?: string;
  isFlagged: boolean;
  vendor: { name: string };
  site: { name: string };
  createdBy: { id: string };
  uiType?: "RECEIVED" | "SENT" | "PENDING";
  brand?: string | null;
  notes?: string | null;
};

type ListResp = {
  items: Tx[];
};

type Nav = NativeStackNavigationProp<AuthedStackParamList>;
type RangeFilter = "ALL" | "TODAY" | "WEEK" | "MONTH" | "CUSTOM";
/** User-facing payment status; maps to API `flow` (Completed → SENT). */
type StatusFilter = "ALL" | "PENDING" | "COMPLETED";

const STATUS_SPECIFIC: Exclude<StatusFilter, "ALL">[] = ["PENDING", "COMPLETED"];

/** Always show every status filter; do not hide options when the current list is filtered. */
const STATUS_DROPDOWN_OPTIONS: StatusFilter[] = ["ALL", ...STATUS_SPECIFIC];

function statusFilterLabel(f: StatusFilter): string {
  switch (f) {
    case "ALL":
      return "All Status";
    case "PENDING":
      return "Pending";
    case "COMPLETED":
      return "Completed";
  }
}

function statusFilterToApiFlow(f: StatusFilter): "ALL" | "PENDING" | "SENT" {
  switch (f) {
    case "ALL":
      return "ALL";
    case "PENDING":
      return "PENDING";
    case "COMPLETED":
      return "SENT";
  }
}

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

function formatEntryDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function transactionDetailLine(item: Tx): string | null {
  const parts = [item.brand?.trim(), item.notes?.trim()].filter(
    (p): p is string => Boolean(p) && p !== item.itemName.trim(),
  );
  if (!parts.length) return null;
  return [...new Set(parts)].join(" · ");
}

/** Mirrors backend `mapRequirement` uiType: RECEIVED = allocation, PENDING = balance due, SENT = fully paid vendor line. */
function transactionListStatus(uiType: Tx["uiType"]): {
  label: "Received" | "Pending" | "Completed";
  kind: "received" | "pending" | "completed";
} {
  const u = uiType ?? "PENDING";
  if (u === "RECEIVED") return { label: "Received", kind: "received" };
  if (u === "PENDING") return { label: "Pending", kind: "pending" };
  return { label: "Completed", kind: "completed" };
}

type TxRowProps = {
  item: Tx;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
};

const TxRow = memo(function TxRow({ item, canEdit, onOpen, onEdit }: TxRowProps) {
  const kind = item.uiType ?? "PENDING";
  const inbound = kind === "RECEIVED";
  const detailExtra = transactionDetailLine(item);
  const txStatus = transactionListStatus(item.uiType);
  const statusPillStyle =
    txStatus.kind === "received"
      ? styles.statusPillReceived
      : txStatus.kind === "pending"
        ? styles.statusPillPending
        : styles.statusPillCompleted;
  const statusTextStyle =
    txStatus.kind === "received"
      ? styles.statusTextReceived
      : txStatus.kind === "pending"
        ? styles.statusTextPending
        : styles.statusTextCompleted;
  const due = Number(item.remaining) || 0;
  const hasDue = !inbound && due > 0.01;

  return (
    <Pressable
      style={({ pressed }) => [styles.txCard, pressed && styles.txCardPressed]}
      onPress={() => onOpen(item.id)}
    >
      <View style={styles.txMiddle}>
        <Text style={styles.txTitle} numberOfLines={2}>
          {item.itemName}
        </Text>
        <Text style={styles.txMeta} numberOfLines={1}>
          {inbound ? "From " : "To "}
          {item.vendor.name}
          {item.site?.name ? ` · ${item.site.name}` : ""}
        </Text>
        {detailExtra ? (
          <Text style={styles.txDetail} numberOfLines={2}>
            {detailExtra}
          </Text>
        ) : null}
        <Text style={styles.txDate}>{formatEntryDate(item.entryDate)}</Text>
        {!inbound ? (
          <Text style={styles.moneyLine}>
            Total {formatRupee(item.totalAmount)} · Paid {formatRupee(item.paidTotal)} · Due{" "}
            {formatRupee(item.remaining)}
          </Text>
        ) : null}
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, inbound ? styles.positive : hasDue ? styles.negative : styles.positive]}>
          {inbound
            ? formatRupeeWithSign(item.paidTotal, "+")
            : hasDue
              ? formatRupeeWithSign(item.remaining, "-")
              : formatRupeeWithSign(item.paidTotal, "-")}
        </Text>
        <View style={[styles.statusPill, statusPillStyle]}>
          <Text style={[styles.statusText, statusTextStyle]}>{txStatus.label}</Text>
        </View>
        {canEdit ? (
          <Pressable
            style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
            onPress={() => onEdit(item.id)}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={16} color={tokens.color.muted} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
});

export function TransactionsScreen() {
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);
  const navigation = useNavigation<Nav>();
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pickerField, setPickerField] = useState<"from" | "to" | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const rangeLabel =
    rangeFilter === "ALL"
      ? "All Date"
      : rangeFilter === "TODAY"
        ? "Today"
        : rangeFilter === "WEEK"
          ? "This week"
          : rangeFilter === "MONTH"
            ? "This month"
            : "Custom";
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter(
        (r) =>
          r.itemName.toLowerCase().includes(q) ||
          r.vendor.name.toLowerCase().includes(q) ||
          (r.site?.name ?? "").toLowerCase().includes(q) ||
          (r.brand ?? "").toLowerCase().includes(q) ||
          (r.notes ?? "").toLowerCase().includes(q),
      );
    }
    // Latest first (entry date, then createdAt)
    return list.slice().sort((a, b) => {
      const dateA = new Date(a.entryDate).getTime();
      const dateB = new Date(b.entryDate).getTime();
      if (dateB !== dateA) return dateB - dateA;
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdB - createdA;
    });
  }, [rows, search]);
  const listContentStyle = useMemo(
    () => [styles.list, styles.listContent, { paddingBottom: tokens.space[5] + 24 }],
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: Tx }) => (
      <TxRow
        item={item}
        canEdit={Boolean(me?.id && item.createdBy?.id === me.id)}
        onOpen={(id) => navigation.navigate("Payment", { id })}
        onEdit={(id) => navigation.navigate("EditEntry", { id })}
      />
    ),
    [me?.id, navigation],
  );

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
          flow: statusFilterToApiFlow(statusFilter),
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
  }, [token, rangeFilter, customFrom, customTo, statusFilter]);

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

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.listLoader}>
          <ActivityIndicator color={tokens.color.accent} />
        </View>
      );
    }
    return <Text style={styles.empty}>{err ? "Could not load transactions" : search.trim() ? "No matching transactions" : "No transactions yet. Tap + to add one."}</Text>;
  }, [loading, err, search]);

  return (
    <View style={styles.wrap}>
      <ScreenChrome title="Transactions" onSettingsPress={() => navigation.navigate("Settings")}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={15} color={tokens.color.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Item, Brand/Person, Site, Details..."
              placeholderTextColor={tokens.color.placeholder}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {err ? (
          <CardContainer style={styles.banner}>
            <Text style={styles.bannerTitle}>Could not load</Text>
            <Text style={styles.bannerMsg}>{err}</Text>
            <Pressable style={styles.retryInline} onPress={load}>
              <Text style={styles.retryInlineText}>Retry</Text>
            </Pressable>
          </CardContainer>
        ) : null}

        <View style={styles.tabRow}>
          <View style={styles.typeDropdownWrap}>
            <Pressable
              style={styles.typeDropdownBtn}
              onPress={() => {
                setFilterOpen(false);
                setStatusFilterOpen((v) => !v);
              }}
            >
              <View style={styles.typeLeftWrap}>
                <Ionicons name="ellipse-outline" size={12} color="#8A7E68" />
                <Text style={styles.typeDropdownText}>{statusFilterLabel(statusFilter)}</Text>
              </View>
              <Ionicons name="chevron-down" size={13} color={tokens.color.muted} />
            </Pressable>
            {statusFilterOpen ? (
              <View style={styles.typeDropdownMenu} pointerEvents="box-none">
                {STATUS_DROPDOWN_OPTIONS.map((f) => (
                  <Pressable
                    key={f}
                    style={({ pressed }) => [styles.typeDropdownItem, pressed && styles.pressed]}
                    onPress={() => {
                      setStatusFilter(f);
                      setStatusFilterOpen(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, statusFilter === f && styles.dropdownItemTextOn]}>
                      {statusFilterLabel(f)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          <Pressable
            style={styles.calendarDropdownBtn}
            onPress={() => {
              setStatusFilterOpen(false);
              setFilterOpen((v) => !v);
            }}
          >
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
      </ScreenChrome>
      <FlatList
        removeClippedSubviews={false}
        style={styles.txList}
        data={filteredRows}
        keyExtractor={(i) => i.id}
        contentContainerStyle={listContentStyle}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={loading && rows.length > 0}
            onRefresh={load}
            colors={[tokens.color.accent]}
            tintColor={tokens.color.accent}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.cardGap} />}
        ListEmptyComponent={listEmpty}
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
                    ? "All Date"
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.color.background },
  txList: { flex: 1, zIndex: 0 },
  listLoader: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.space[5],
  },
  list: { paddingHorizontal: tokens.space[2] },
  listContent: { flexGrow: 1 },
  cardGap: { height: tokens.space[1] },
  screenSub: { fontSize: tokens.textSize.small, color: tokens.color.muted, fontWeight: "500" },
  banner: { gap: tokens.space[1], borderColor: tokens.color.negativeMuted, backgroundColor: tokens.color.negativeMuted },
  bannerTitle: { color: tokens.color.negative, fontWeight: "700", fontSize: tokens.textSize.small },
  bannerMsg: { color: tokens.color.muted, fontSize: tokens.textSize.caption, lineHeight: 18 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: tokens.space[1] },
  searchBox: {
    flex: 1,
    height: 42,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, color: tokens.color.text, fontSize: 12, paddingVertical: 0 },
  moneyLine: { marginTop: 4, fontSize: 11, color: tokens.color.muted },
  retryInline: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  retryInlineText: { color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  typeDropdownWrap: {
    flex: 1,
    position: "relative",
    zIndex: 40,
  },
  typeDropdownBtn: {
    height: 36,
    width: "100%",
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
  typeDropdownMenu: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  typeDropdownItem: { paddingHorizontal: tokens.space[2], paddingVertical: 10 },
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
    width: 28,
    height: 28,
    borderRadius: tokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.blockHover,
  },
  editBtnPressed: { opacity: 0.85, backgroundColor: tokens.color.border },
  txCard: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: tokens.color.panel,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    ...tokens.shadow.card,
  },
  txCardPressed: {
    backgroundColor: tokens.color.blockHover,
  },
  txMiddle: { flex: 1, minWidth: 0 },
  txTitle: { fontSize: 14, fontWeight: "600", color: tokens.color.text },
  txMeta: { fontSize: 11, color: tokens.color.muted, marginTop: 2 },
  txDetail: { fontSize: 11, color: tokens.color.text, marginTop: 4, lineHeight: 15, opacity: 0.92 },
  txDate: { fontSize: 11, color: tokens.color.muted, marginTop: 4, fontWeight: "600" },
  txRight: { alignItems: "flex-end", gap: 6 },
  txAmount: { fontSize: 20, fontWeight: "700" },
  statusPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillPending: { backgroundColor: "#FDF6E9" },
  statusPillReceived: { backgroundColor: "#EDE4D6" },
  statusPillCompleted: { backgroundColor: "#EAF5EE" },
  statusText: { fontSize: 10, fontWeight: "600" },
  statusTextPending: { color: "#8C5A2B" },
  statusTextReceived: { color: "#5F5342" },
  statusTextCompleted: { color: "#2E7E59" },
  empty: { textAlign: "center", color: tokens.color.muted, marginTop: tokens.space[4], fontSize: tokens.textSize.small, lineHeight: 20 },
});