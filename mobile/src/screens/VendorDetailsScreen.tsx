import { createApi } from "@/data/api/client";
import { CardContainer } from "@/components/ui/CardContainer";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Vendor = {
  id: string;
  name: string;
  phone?: string | null;
  alternatePhone?: string | null;
  gstNumber?: string | null;
  totals: { pending: string; paid: string };
};

type RequirementItem = {
  id: string;
  itemName: string;
  paidTotal: string;
  entryDate: string;
};

type RequirementListResp = {
  items: RequirementItem[];
};

type RequirementDetail = {
  id: string;
  itemName: string;
  payments: {
    id: string;
    amount: string;
    paidAt: string;
    note?: string | null;
  }[];
};

type PaymentHistoryItem = {
  id: string;
  requirementId: string;
  itemName: string;
  amount: string;
  paidAt: string;
  note?: string | null;
};

type VendorRoute = RouteProp<AuthedStackParamList, "VendorDetails">;
type HistoryFilter = "ALL" | "TODAY" | "WEEK" | "MONTH";

function inFilterRange(date: string, filter: HistoryFilter) {
  if (filter === "ALL") return true;

  const now = new Date();
  const paidAt = new Date(date);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === "TODAY") return paidAt >= startOfToday;

  if (filter === "WEEK") {
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    return paidAt >= startOfWeek;
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return paidAt >= startOfMonth;
}

export function VendorDetailsScreen() {
  const { params } = useRoute<VendorRoute>();
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("ALL");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const api = createApi(() => token);
        const allVendors = await api.get<Vendor[]>("/vendors");
        const selectedVendor = allVendors.find((v) => v.id === params.id) || null;
        if (!selectedVendor) {
          throw new Error("Vendor not found");
        }

        const reqList = await api.get<RequirementListResp>("/requirements", {
          page: "1",
          limit: "100",
          vendorId: params.id,
        });

        const detailed = await Promise.all(
          reqList.items.map((item) => api.get<RequirementDetail>(`/requirements/${item.id}`)),
        );
        const paymentRows: PaymentHistoryItem[] = detailed.flatMap((req) =>
          req.payments.map((p) => ({
            id: p.id,
            requirementId: req.id,
            itemName: req.itemName,
            amount: p.amount,
            paidAt: p.paidAt,
            note: p.note,
          })),
        );

        if (cancelled) return;
        setVendor(selectedVendor);
        setPayments(paymentRows);
      } catch (error) {
        if (cancelled) return;
        setErr(error instanceof Error ? error.message : "Could not load vendor details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, token]);

  useFocusEffect(load);

  const filteredPayments = useMemo(
    () =>
      payments
        .filter((p) => inFilterRange(p.paidAt, historyFilter))
        .slice()
        .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()),
    [historyFilter, payments],
  );

  const filteredTotal = useMemo(
    () => filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [filteredPayments],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.color.accent} />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>{err || "Vendor details unavailable"}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.wrap,
        { paddingTop: tokens.space[2], paddingBottom: insets.bottom + tokens.space[4] },
      ]}
    >
      <CardContainer style={styles.block}>
        <Text style={styles.title}>{vendor.name}</Text>
        <Text style={styles.meta}>Phone: {vendor.phone || "-"}</Text>
        <Text style={styles.meta}>Alternate: {vendor.alternatePhone || "-"}</Text>
        <Text style={styles.meta}>GST: {vendor.gstNumber || "-"}</Text>
      </CardContainer>

      <View style={styles.kpiRow}>
        <CardContainer style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Paid (all)</Text>
          <Text style={[styles.kpiValue, styles.positive]}>{vendor.totals.paid}</Text>
        </CardContainer>
        <CardContainer style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Pending</Text>
          <Text style={[styles.kpiValue, styles.negative]}>{vendor.totals.pending}</Text>
        </CardContainer>
        <CardContainer style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Paid (filtered)</Text>
          <Text style={[styles.kpiValue, styles.positive]}>{filteredTotal.toFixed(0)}</Text>
        </CardContainer>
      </View>

      <CardContainer style={styles.block}>
        <Text style={styles.sectionTitle}>Payment history</Text>
        <View style={styles.filterRow}>
          <Pressable
            style={({ pressed }) => [styles.filterChip, historyFilter === "ALL" && styles.filterChipOn, pressed && styles.pressed]}
            onPress={() => setHistoryFilter("ALL")}
          >
            <Text style={[styles.filterChipText, historyFilter === "ALL" && styles.filterChipTextOn]}>All</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.filterChip, historyFilter === "TODAY" && styles.filterChipOn, pressed && styles.pressed]}
            onPress={() => setHistoryFilter("TODAY")}
          >
            <Text style={[styles.filterChipText, historyFilter === "TODAY" && styles.filterChipTextOn]}>Today</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.filterChip, historyFilter === "WEEK" && styles.filterChipOn, pressed && styles.pressed]}
            onPress={() => setHistoryFilter("WEEK")}
          >
            <Text style={[styles.filterChipText, historyFilter === "WEEK" && styles.filterChipTextOn]}>This week</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.filterChip, historyFilter === "MONTH" && styles.filterChipOn, pressed && styles.pressed]}
            onPress={() => setHistoryFilter("MONTH")}
          >
            <Text style={[styles.filterChipText, historyFilter === "MONTH" && styles.filterChipTextOn]}>This month</Text>
          </Pressable>
        </View>

        {err ? <Text style={styles.err}>{err}</Text> : null}

        {filteredPayments.length ? (
          filteredPayments.map((p) => (
            <View key={`${p.requirementId}-${p.id}`} style={styles.payRow}>
              <View style={styles.payTop}>
                <Text style={styles.payAmt}>+ {p.amount}</Text>
                <Text style={styles.payDate}>{new Date(p.paidAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.payItem} numberOfLines={1}>
                {p.itemName}
              </Text>
              <Text style={styles.payTime}>{new Date(p.paidAt).toLocaleTimeString()}</Text>
              {p.note ? <Text style={styles.payNote}>{p.note}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.hint}>No payments found for selected date range.</Text>
        )}
      </CardContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: tokens.color.background },
  wrap: {
    paddingHorizontal: tokens.space[2],
    gap: tokens.space[2],
    backgroundColor: tokens.color.background,
  },
  block: { gap: tokens.space[1] },
  title: {
    fontSize: tokens.textSize.title,
    fontWeight: "700",
    color: tokens.color.text,
    letterSpacing: -0.3,
  },
  meta: { fontSize: tokens.textSize.small, color: tokens.color.muted, lineHeight: 20 },
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
  sectionTitle: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "600",
    color: tokens.color.text,
    letterSpacing: -0.2,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space[1], marginTop: tokens.space[1] },
  filterChip: {
    paddingHorizontal: tokens.space[2],
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.panelMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  filterChipOn: { backgroundColor: tokens.color.accentMuted, borderColor: tokens.color.accent },
  filterChipText: { color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
  filterChipTextOn: { color: tokens.color.accent },
  payRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: tokens.space[2],
    gap: 4,
    backgroundColor: tokens.color.panelMuted,
    marginTop: tokens.space[1],
  },
  payTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  payAmt: { color: tokens.color.positive, fontWeight: "700", fontSize: tokens.textSize.small },
  payDate: { color: tokens.color.muted, fontSize: tokens.textSize.caption, fontWeight: "600" },
  payItem: { color: tokens.color.text, fontSize: tokens.textSize.small, fontWeight: "600" },
  payTime: { color: tokens.color.muted, fontSize: tokens.textSize.caption },
  payNote: { color: tokens.color.text, fontSize: tokens.textSize.caption },
  hint: { fontSize: tokens.textSize.small, color: tokens.color.muted, lineHeight: 20, textAlign: "center" },
  err: { color: tokens.color.negative, fontSize: tokens.textSize.small, fontWeight: "600", textAlign: "center", marginTop: 2 },
  pressed: { opacity: 0.88 },
});
