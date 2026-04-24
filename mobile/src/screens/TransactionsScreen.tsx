import { createApi } from "@/data/api/client";
import { ApiError } from "@/data/api/client";
import { CardContainer } from "@/components/ui/CardContainer";
import { ListItem } from "@/components/ui/ListItem";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const totals = useMemo(() => {
    let total = 0;
    let paid = 0;
    let due = 0;
    for (const r of rows) {
      total += Number(r.totalAmount || 0);
      paid += Number(r.paidTotal || 0);
      due += Number(r.remaining || 0);
    }
    return { total, paid, due };
  }, [rows]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const api = createApi(() => token);
        const range = getRangeQuery(rangeFilter, customFrom, customTo);
        const data = await api.get<ListResp>("/requirements", { page: "1", limit: "100", ...range });
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
  }, [token, rangeFilter, customFrom, customTo]);

  useFocusEffect(load);

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
        data={rows}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.screenTitle}>Activity</Text>
            <Text style={styles.screenSub}>Totals across loaded requirements</Text>

            {err ? (
              <CardContainer style={styles.banner}>
                <Text style={styles.bannerTitle}>Could not load</Text>
                <Text style={styles.bannerMsg}>{err}</Text>
              </CardContainer>
            ) : null}

            <View style={styles.kpiRow}>
              <CardContainer style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total</Text>
                <Text style={styles.kpiValue}>{totals.total.toFixed(0)}</Text>
              </CardContainer>
              <CardContainer style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Paid</Text>
                <Text style={[styles.kpiValue, styles.positive]}>{totals.paid.toFixed(0)}</Text>
              </CardContainer>
              <CardContainer style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Due</Text>
                <Text style={[styles.kpiValue, styles.negative]}>{totals.due.toFixed(0)}</Text>
              </CardContainer>
            </View>

            <Text style={styles.sectionLabel}>Recent</Text>
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
          </View>
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.itemName}
            subtitle={`${item.vendor.name} · ${item.site.name} · Paid ${item.paidTotal}${item.entryDate ? ` · ${shortDate(item.entryDate)}` : ""}`}
            amountLabel={`Due ${item.remaining}`}
            amountTone="negative"
            leadingGlyph={item.isFlagged ? "!" : undefined}
            onPress={() => navigation.navigate("Payment", { id: item.id })}
            rightSlot={
              me?.id && item.createdBy?.id === me.id ? (
                <Pressable
                  style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
                  onPress={() => navigation.navigate("EditEntry", { id: item.id })}
                  hitSlop={8}
                >
                  <Text style={styles.editIcon}>{"\u270E"}</Text>
                </Pressable>
              ) : null
            }
          />
        )}
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
  kpiRow: { flexDirection: "row", gap: tokens.space[1] },
  kpiCard: { flex: 1, padding: tokens.space[2] },
  kpiLabel: {
    fontSize: tokens.textSize.caption,
    lineHeight: 16,
    color: tokens.color.muted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  kpiValue: {
    marginTop: 6,
    fontSize: tokens.textSize.subtitle,
    lineHeight: 24,
    fontWeight: "700",
    color: tokens.color.text,
    fontVariant: ["tabular-nums"],
  },
  positive: { color: tokens.color.positive },
  negative: { color: tokens.color.negative },
  sectionLabel: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "600",
    color: tokens.color.text,
    letterSpacing: -0.2,
    marginTop: tokens.space[1],
  },
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
    width: 36,
    height: 36,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.panelMuted,
  },
  editBtnPressed: { opacity: 0.85, backgroundColor: tokens.color.border },
  editIcon: { fontSize: 16, color: tokens.color.text },
  empty: { textAlign: "center", color: tokens.color.muted, marginTop: tokens.space[4], fontSize: tokens.textSize.small, lineHeight: 20 },
});
