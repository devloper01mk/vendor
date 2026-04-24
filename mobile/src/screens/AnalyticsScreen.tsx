import { CardContainer } from "@/components/ui/CardContainer";
import { InsightBars, type InsightBarDatum } from "@/components/ui/InsightBars";
import { ListItem } from "@/components/ui/ListItem";
import { createApi } from "@/data/api/client";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Summary = {
  totals: { paid: string; pending: string; committed: string };
  memberWallet?: { received: string; spent: string; balance: string } | null;
  siteSpend: { siteId: string; name: string; paid: string }[];
  highlighted: { requirementId: string; itemName: string; vendorName: string; siteName: string }[];
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

export function AnalyticsScreen() {
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pickerField, setPickerField] = useState<"from" | "to" | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  const chartData: InsightBarDatum[] = useMemo(() => {
    const rows = data?.siteSpend ?? [];
    return rows.map((s) => ({
      id: s.siteId,
      label: s.name,
      value: Number(s.paid) || 0,
      displayValue: s.paid,
    }));
  }, [data]);
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

  useFocusEffect(
    useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = createApi(() => token);
        const range = getRangeQuery(rangeFilter, customFrom, customTo);
        const d = await api.get<Summary>("/dashboard/summary", range);
        if (!cancelled) setData(d);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    }, [token, rangeFilter, customFrom, customTo]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.color.accent} />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[styles.list, { paddingTop: Math.max(insets.top, tokens.space[2]) }]}
      data={data?.siteSpend ?? []}
      keyExtractor={(i) => i.siteId}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
         
          <View style={styles.dropdownWrap}>
            <Pressable style={styles.dropdownBtn} onPress={() => setFilterOpen((v) => !v)}>
              <Text style={styles.dropdownText}>{rangeLabel}</Text>
              <Text style={styles.dropdownIcon}>▾</Text>
            </Pressable>
            {filterOpen ? (
              <View style={styles.dropdownMenu}>
                {(["ALL", "TODAY", "WEEK", "MONTH", "CUSTOM"] as const).map((f) => (
                  <Pressable
                    key={f}
                    style={({ pressed }) => [styles.dropdownItem, pressed && styles.pressed]}
                    onPress={() => {
                      setRangeFilter(f);
                      setFilterOpen(false);
                      if (f !== "CUSTOM") {
                        setPickerField(null);
                      }
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
            ) : null}
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

          <CardContainer style={styles.hero}>
            <Text style={styles.heroLabel}>Total paid</Text>
            <Text style={styles.heroValue}>{data?.totals.paid ?? "—"}</Text>
            <View style={styles.heroGrid}>
              <View style={styles.heroCell}>
                <Text style={styles.heroCellLabel}>Pending</Text>
                <Text style={styles.heroCellValueWarn}>{data?.totals.pending ?? "—"}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroCell}>
                <Text style={styles.heroCellLabel}>Committed</Text>
                <Text style={styles.heroCellValue}>{data?.totals.committed ?? "—"}</Text>
              </View>
            </View>
          </CardContainer>

          {data?.memberWallet ? (
            <CardContainer style={styles.hero}>
              <Text style={styles.heroLabel}>Received from admin</Text>
              <Text style={styles.heroValue}>{data.memberWallet.received}</Text>
              <View style={styles.heroGrid}>
                <View style={styles.heroCell}>
                  <Text style={styles.heroCellLabel}>Spent to vendors</Text>
                  <Text style={styles.heroCellValue}>{data.memberWallet.spent}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroCell}>
                  <Text style={styles.heroCellLabel}>Available balance</Text>
                  <Text style={styles.heroCellValueWarn}>{data.memberWallet.balance}</Text>
                </View>
              </View>
            </CardContainer>
          ) : null}

          <CardContainer style={styles.insightCard}>
            <InsightBars title="Spend by site" data={chartData} emptyLabel="No paid spend in this period yet" />
          </CardContainer>

          <CardContainer style={styles.highlightCard}>
            <Text style={styles.sectionTitle}>Needs attention</Text>
            <Text style={styles.sectionHint}>Flagged or highlighted line items</Text>
            {(data?.highlighted ?? []).length ? (
              <View style={styles.highlightList}>
                {(data?.highlighted ?? []).map((h) => (
                  <View key={h.requirementId} style={styles.highlightRow}>
                    <Text style={styles.highlightBullet}>●</Text>
                    <View style={styles.highlightTextWrap}>
                      <Text style={styles.highlightTitle}>{h.itemName}</Text>
                      <Text style={styles.highlightMeta}>
                        {h.vendorName} · {h.siteName}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyInline}>You are all caught up — nothing highlighted.</Text>
            )}
          </CardContainer>

          <Text style={styles.listSectionTitle}>Paid by site</Text>
        </View>
      }
      renderItem={({ item }) => (
        <ListItem
          title={item.name}
          subtitle="Total paid in selected period"
          amountLabel={item.paid}
          amountTone="positive"
          onPress={() => {}}
          leadingGlyph="◎"
          showChevron={false}
        />
      )}
      ListEmptyComponent={<Text style={styles.empty}>No analytics data</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", backgroundColor: tokens.color.background },
  list: {
    paddingHorizontal: tokens.space[2],
    paddingBottom: tokens.space[5],
    gap: tokens.space[2],
    backgroundColor: tokens.color.background,
  },
  headerBlock: { gap: tokens.space[2], marginBottom: tokens.space[1] },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  kicker: {
    fontSize: tokens.textSize.caption,
    fontWeight: "700",
    color: tokens.color.accent,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: tokens.textSize.hero,
    fontWeight: "700",
    color: tokens.color.text,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  screenSub: {
    marginTop: 4,
    fontSize: tokens.textSize.small,
    color: tokens.color.muted,
    fontWeight: "500",
  },
  hero: {
    padding: tokens.space[3],
    gap: tokens.space[1],
    borderWidth: 0,
    backgroundColor: tokens.color.panel,
  },
  heroLabel: {
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
    color: tokens.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: "700",
    color: tokens.color.positive,
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
  heroGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: tokens.space[2],
    paddingTop: tokens.space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border,
  },
  heroCell: { flex: 1, gap: 4 },
  heroDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: tokens.color.border, marginHorizontal: tokens.space[2] },
  heroCellLabel: { fontSize: tokens.textSize.caption, color: tokens.color.muted, fontWeight: "500" },
  heroCellValue: { fontSize: tokens.textSize.subtitle, fontWeight: "700", color: tokens.color.text, fontVariant: ["tabular-nums"] },
  heroCellValueWarn: { fontSize: tokens.textSize.subtitle, fontWeight: "700", color: tokens.color.negative, fontVariant: ["tabular-nums"] },
  insightCard: { paddingVertical: tokens.space[3] },
  highlightCard: { gap: tokens.space[1] },
  sectionTitle: {
    fontSize: tokens.textSize.subtitle,
    lineHeight: 24,
    fontWeight: "600",
    color: tokens.color.text,
    letterSpacing: -0.2,
  },
  sectionHint: { fontSize: tokens.textSize.caption, color: tokens.color.muted, marginTop: 2 },
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
  dropdownMenu: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    overflow: "hidden",
    zIndex: 30,
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
  highlightList: { marginTop: tokens.space[2], gap: tokens.space[1] },
  highlightRow: { flexDirection: "row", gap: tokens.space[1], alignItems: "flex-start" },
  highlightBullet: { color: tokens.color.accent, fontSize: 10, marginTop: 6 },
  highlightTextWrap: { flex: 1, gap: 2 },
  highlightTitle: { fontSize: tokens.textSize.body, fontWeight: "600", color: tokens.color.text },
  highlightMeta: { fontSize: tokens.textSize.caption, color: tokens.color.muted },
  listSectionTitle: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "600",
    color: tokens.color.text,
    marginTop: tokens.space[1],
    letterSpacing: -0.2,
  },
  emptyInline: { fontSize: tokens.textSize.small, color: tokens.color.muted, marginTop: tokens.space[1] },
  empty: { textAlign: "center", color: tokens.color.muted, marginTop: tokens.space[4], fontSize: tokens.textSize.small },
});
