import { CardContainer } from "@/components/ui/CardContainer";
import { InsightBars, type InsightBarDatum } from "@/components/ui/InsightBars";
import { ListItem } from "@/components/ui/ListItem";
import { createApi } from "@/data/api/client";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import { useFocusEffect, useNavigation, type NavigationProp } from "@react-navigation/native";
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
  const navigation = useNavigation<NavigationProp<AuthedStackParamList>>();
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
  const quickStats = useMemo(
    () => [
      { key: "users", label: "Items", value: String(data?.highlighted?.length ?? 0), icon: "◌" },
      { key: "vendors", label: "Sites", value: String(data?.siteSpend?.length ?? 0), icon: "⌂" },
      { key: "tx", label: "Pending", value: data?.totals.pending ?? "0", icon: "▤" },
      { key: "spend", label: "Committed", value: data?.totals.committed ?? "0", icon: "◎" },
    ],
    [data],
  );
  const paidN = Number(data?.totals.paid ?? 0);
  const committedN = Number(data?.totals.committed ?? 0);
  const pendingN = Number(data?.totals.pending ?? 0);
  const paidPct = committedN > 0 ? Math.min(99.9, (paidN / committedN) * 100) : 0;
  const pendingPct = committedN > 0 ? Math.min(99.9, (pendingN / committedN) * 100) : 0;
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
          <View style={styles.topRow}>
            <Pressable style={styles.topIconBtn}>
              <Text style={styles.topIcon}>☰</Text>
            </Pressable>
            <Text style={styles.topTitle}>Dashboard</Text>
            <View style={styles.topRight}>
              <Pressable style={styles.topIconBtn}>
                <Text style={styles.topIcon}>◌</Text>
              </Pressable>
              <Pressable style={styles.avatar} onPress={() => navigation.navigate("Settings")}>
                <Text style={styles.avatarText}>AS</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.dropdownWrap}>
            <Pressable style={styles.dropdownBtn} onPress={() => setFilterOpen((v) => !v)}>
              <Text style={styles.dropdownText}>⌁ {rangeLabel}</Text>
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
            <View style={styles.heroHeadRow}>
              <View style={styles.heroLeadingIcon}>
                <Text style={styles.heroLeadingIconText}>◍</Text>
              </View>
              <View style={styles.heroTrend}>
                <Text style={styles.heroTrendText}>↗ {paidPct.toFixed(1)}%</Text>
              </View>
            </View>
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
              <View style={styles.heroHeadRow}>
                <View style={styles.heroLeadingIcon}>
                  <Text style={styles.heroLeadingIconText}>↓</Text>
                </View>
                <View style={styles.heroTrend}>
                  <Text style={styles.heroTrendText}>↗ {pendingPct.toFixed(1)}%</Text>
                </View>
              </View>
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
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>Spend by site</Text>
              <Pressable style={styles.viewAllBtn}>
                <Text style={styles.viewAllText}>View All</Text>
              </Pressable>
            </View>
            <InsightBars data={chartData} emptyLabel="No paid spend in this period yet" />
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

          <CardContainer style={styles.quickCard}>
            <View style={styles.quickGrid}>
              {quickStats.map((stat) => (
                <View key={stat.key} style={styles.quickTile}>
                  <View style={styles.quickIconWrap}>
                    <Text style={styles.quickIcon}>{stat.icon}</Text>
                  </View>
                  <Text style={styles.quickLabel}>{stat.label}</Text>
                  <Text style={styles.quickValue}>{stat.value}</Text>
                </View>
              ))}
            </View>
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
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  topIcon: { fontSize: 16, color: tokens.color.text },
  topTitle: { flex: 1, marginLeft: 8, fontSize: 18, color: tokens.color.text, fontWeight: "600" },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EDE4D6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 12, color: "#5F5342", fontWeight: "600" },
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
    padding: tokens.space[2],
    gap: tokens.space[1],
    borderWidth: 1,
    backgroundColor: tokens.color.panel,
  },
  heroHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLeadingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F4EFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLeadingIconText: { fontSize: 14, color: "#7F725A", fontWeight: "700" },
  heroTrend: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "#ECF6F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroTrendText: { fontSize: 12, color: "#2E7E59", fontWeight: "600" },
  heroLabel: {
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
    color: tokens.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: 34,
    fontWeight: "700",
    color: tokens.color.positive,
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
  heroGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: tokens.space[1],
    paddingTop: tokens.space[2],
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
  },
  heroCell: { flex: 1, gap: 4 },
  heroDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: tokens.color.border, marginHorizontal: tokens.space[2] },
  heroCellLabel: { fontSize: tokens.textSize.caption, color: tokens.color.muted, fontWeight: "500" },
  heroCellValue: { fontSize: 24, fontWeight: "700", color: tokens.color.text, fontVariant: ["tabular-nums"] },
  heroCellValueWarn: { fontSize: 24, fontWeight: "700", color: tokens.color.negative, fontVariant: ["tabular-nums"] },
  insightCard: { paddingVertical: tokens.space[3] },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: tokens.space[2] },
  viewAllBtn: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panelMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewAllText: { fontSize: 12, color: tokens.color.text, fontWeight: "600" },
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
    width: 176,
    position: "relative",
    zIndex: 20,
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.xl,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
  quickCard: { paddingVertical: tokens.space[2] },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: tokens.space[2] },
  quickTile: { width: "25%", alignItems: "center", paddingHorizontal: 4 },
  quickIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.color.panelMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickIcon: { color: "#8D7F65", fontSize: 13, fontWeight: "700" },
  quickLabel: { fontSize: 11, color: tokens.color.muted },
  quickValue: { marginTop: 3, fontSize: 22, lineHeight: 24, color: tokens.color.text, fontWeight: "700" },
});
