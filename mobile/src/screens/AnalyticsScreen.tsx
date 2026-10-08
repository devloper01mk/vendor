import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { CardContainer } from "@/components/ui/CardContainer";
import { InsightBars, type InsightBarDatum } from "@/components/ui/InsightBars";
import { ListItem } from "@/components/ui/ListItem";
import { ScaledAmountText } from "@/components/ui/ScaledAmountText";
import { ScreenChrome } from "@/components/ui/ScreenChrome";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { createApi } from "@/data/api/client";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import { useFocusEffect, useNavigation, type NavigationProp } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";

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
      {
        key: "users",
        label: "Items",
        value: String(data?.highlighted?.length ?? 0),
        icon: "cube-outline" as AppIconName,
        currency: false,
      },
      {
        key: "vendors",
        label: "Sites",
        value: String(data?.siteSpend?.length ?? 0),
        icon: "location-outline" as AppIconName,
        currency: false,
      },
      {
        key: "tx",
        label: "Pending",
        value: data?.totals.pending ?? "0",
        icon: "time-outline" as AppIconName,
        currency: true,
      },
      {
        key: "spend",
        label: "Committed",
        value: data?.totals.committed ?? "0",
        icon: "wallet-outline" as AppIconName,
        currency: true,
      },
    ],
    [data],
  );

  const paidN = Number(data?.totals.paid ?? 0);
  const committedN = Number(data?.totals.committed ?? 0);
  const pendingN = Number(data?.totals.pending ?? 0);
  const walletBalanceN = Number(data?.memberWallet?.balance ?? 0);
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

  const listContentStyle = useMemo(
    () => [styles.list, styles.listContent],
    [],
  );

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
    <View style={styles.screenWrap}>
      <ScreenChrome title="Dashboard" onSettingsPress={() => navigation.navigate("Settings")}>
        <View style={styles.dropdownWrap}>
          <Pressable style={styles.dropdownBtn} onPress={() => setFilterOpen((v) => !v)}>
            <AppIcon name="funnel-outline" size={14} color={tokens.color.muted} />
            <Text style={styles.dropdownText}>{rangeLabel}</Text>
            <AppIcon name="chevron-down" size={13} color={tokens.color.muted} />
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
      </ScreenChrome>

      <FlatList
        style={styles.dashboardList}
        contentContainerStyle={listContentStyle}
        data={data?.siteSpend ?? []}
        keyExtractor={(i) => i.siteId}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <CardContainer style={styles.hero}>
              <View style={styles.heroHeadRow}>
                <View style={styles.heroLeadingIcon}>
                  <AppIcon name="wallet-outline" size={16} color={tokens.color.accent} />
                </View>
                <View style={styles.heroTrend}>
                  <Text style={styles.heroTrendText}>↗ {paidPct.toFixed(1)}%</Text>
                </View>
              </View>
              <View style={styles.heroAmountRow}>
                <Text style={styles.heroLabel}>Total paid</Text>
                <ScaledAmountText
                  baseSize={24}
                  align="right"
                  containerStyle={styles.heroValueContainer}
                  style={styles.heroValue}
                >
                  {data?.totals.paid ?? "—"}
                </ScaledAmountText>
              </View>
              <View style={styles.heroGrid}>
                <View style={styles.heroCell}>
                  <Text style={styles.heroCellLabel}>Pending</Text>
                  <ScaledAmountText
                    baseSize={24}
                    containerStyle={styles.heroCellValueContainer}
                    style={styles.heroCellValueWarn}
                  >
                    {data?.totals.pending ?? "—"}
                  </ScaledAmountText>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroCell}>
                  <Text style={styles.heroCellLabel}>Committed</Text>
                  <ScaledAmountText
                    baseSize={24}
                    containerStyle={styles.heroCellValueContainer}
                    style={styles.heroCellValue}
                  >
                    {data?.totals.committed ?? "—"}
                  </ScaledAmountText>
                </View>
              </View>
            </CardContainer>

            {data?.memberWallet ? (
              <CardContainer style={styles.hero}>
                <View style={styles.heroHeadRow}>
                  <View style={styles.heroLeadingIcon}>
                    <AppIcon name="arrow-down-outline" size={16} color={tokens.color.positive} />
                  </View>
                  <View style={styles.heroTrend}>
                    <Text style={styles.heroTrendText}>↗ {pendingPct.toFixed(1)}%</Text>
                  </View>
                </View>
                <View style={styles.heroAmountRow}>
                  <Text style={styles.heroLabel}>Received from admin</Text>
                  <ScaledAmountText
                    baseSize={24}
                    align="right"
                    containerStyle={styles.heroValueContainer}
                    style={styles.heroValue}
                  >
                    {data.memberWallet.received}
                  </ScaledAmountText>
                </View>
                <View style={styles.heroGrid}>
                  <View style={styles.heroCell}>
                    <Text style={styles.heroCellLabel}>Spent to vendors</Text>
                    <ScaledAmountText
                      baseSize={24}
                      containerStyle={styles.heroCellValueContainer}
                      style={styles.heroCellValue}
                    >
                      {data.memberWallet.spent}
                    </ScaledAmountText>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroCell}>
                    <Text style={styles.heroCellLabel}>Available balance</Text>
                    <ScaledAmountText
                      baseSize={24}
                      containerStyle={styles.heroCellValueContainer}
                      style={walletBalanceN < 0 ? styles.heroCellValueWarn : styles.heroCellValue}
                      sign={walletBalanceN < 0 ? "-" : ""}
                    >
                      {data.memberWallet.balance}
                    </ScaledAmountText>
                  </View>
                </View>
              </CardContainer>
            ) : null}

            <CardContainer style={styles.insightCard}>
              <SectionLabel>Spend by site</SectionLabel>
              <InsightBars
                data={chartData}
                emptyLabel="No paid spend in this period yet"
                onPressItem={(siteId) => navigation.navigate("SiteDetails", { id: siteId })}
              />
            </CardContainer>

            <CardContainer style={styles.highlightCard}>
              <SectionLabel>Needs attention</SectionLabel>
              <Text style={styles.sectionHint}>Flagged or highlighted line items</Text>
              {(data?.highlighted ?? []).length ? (
                <View style={styles.highlightList}>
                  {(data?.highlighted ?? []).map((h) => (
                    <Pressable
                      key={h.requirementId}
                      style={({ pressed }) => [styles.highlightRow, pressed && styles.pressed]}
                      onPress={() => navigation.navigate("Payment", { id: h.requirementId })}
                    >
                      <Text style={styles.highlightBullet}>●</Text>
                      <View style={styles.highlightTextWrap}>
                        <Text style={styles.highlightTitle}>{h.itemName}</Text>
                        <Text style={styles.highlightMeta}>
                          {h.vendorName} · {h.siteName}
                        </Text>
                      </View>
                    </Pressable>
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
                      <AppIcon name={stat.icon} size={14} color={tokens.color.muted} />
                    </View>
                    <Text style={styles.quickLabel}>{stat.label}</Text>
                    <ScaledAmountText
                      baseSize={18}
                      minimumFontScale={0.45}
                      currency={stat.currency}
                      containerStyle={styles.quickValueContainer}
                      style={styles.quickValue}
                    >
                      {stat.value}
                    </ScaledAmountText>
                  </View>
                ))}
              </View>
            </CardContainer>

            <SectionLabel>Paid by site</SectionLabel>
          </View>
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.name}
            subtitle="Total paid in selected period"
            amountLabel={item.paid}
            amountTone="positive"
            onPress={() => navigation.navigate("SiteDetails", { id: item.siteId })}
            leadingGlyph={item.name.trim().charAt(0).toUpperCase()}
            showChevron
            variant="card"
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.cardGap} />}
        ListEmptyComponent={<Text style={styles.empty}>No analytics data</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", backgroundColor: tokens.color.background },
  screenWrap: { flex: 1, backgroundColor: tokens.color.background },
  dashboardList: { flex: 1 },
  list: {
    paddingHorizontal: tokens.space[2],
    paddingBottom: tokens.space[5],
    backgroundColor: tokens.color.background,
  },
  listContent: { flexGrow: 1 },
  cardGap: { height: tokens.space[1] },
  headerBlock: { gap: tokens.space[2], marginBottom: tokens.space[1], paddingTop: tokens.space[1] },
  hero: {
    padding: tokens.space[2],
    gap: tokens.space[1],
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.panel,
  },
  heroHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLeadingIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTrend: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.positiveMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroTrendText: { fontSize: 12, color: tokens.color.positive, fontWeight: "600" },
  heroLabel: {
    flexShrink: 1,
    maxWidth: "38%",
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
    color: tokens.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space[1],
    width: "100%",
  },
  heroValueContainer: {
    flex: 1,
    minWidth: 100,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  heroValue: {
    color: tokens.color.positive,
    letterSpacing: -0.5,
    width: "100%",
  },
  heroGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: tokens.space[1],
    paddingTop: tokens.space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border,
  },
  heroCell: { flex: 1, gap: 6, minWidth: 0, alignItems: "flex-start" },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: tokens.color.border,
    marginHorizontal: tokens.space[2],
  },
  heroCellLabel: { fontSize: tokens.textSize.caption, color: tokens.color.muted, fontWeight: "500" },
  heroCellValueContainer: {
    width: "100%",
    alignItems: "flex-start",
  },
  heroCellValue: { color: tokens.color.text },
  heroCellValueWarn: { color: tokens.color.negative },
  insightCard: { paddingVertical: tokens.space[2], gap: tokens.space[1] },
  highlightCard: { gap: tokens.space[1] },
  sectionHint: { fontSize: tokens.textSize.caption, color: tokens.color.muted, marginTop: 2 },
  dropdownWrap: {
    alignSelf: "flex-start",
    width: 176,
    position: "relative",
    zIndex: 20,
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 10,
  },
  dropdownText: { flex: 1, color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
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
    ...tokens.shadow.card,
  },
  dropdownItem: { paddingHorizontal: tokens.space[2], paddingVertical: 10 },
  dropdownItemText: { color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
  dropdownItemTextOn: { color: tokens.color.ink, fontWeight: "700" },
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
  emptyInline: { fontSize: tokens.textSize.small, color: tokens.color.muted, marginTop: tokens.space[1] },
  empty: { textAlign: "center", color: tokens.color.muted, marginTop: tokens.space[4], fontSize: tokens.textSize.small },
  quickCard: { paddingVertical: tokens.space[2] },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: tokens.space[2] },
  quickTile: { width: "50%", alignItems: "flex-start", paddingHorizontal: 8, minWidth: 0 },
  quickIconWrap: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.panelMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickLabel: { fontSize: 11, color: tokens.color.muted },
  quickValueContainer: { width: "100%", marginTop: 3 },
  quickValue: { color: tokens.color.text },
});
