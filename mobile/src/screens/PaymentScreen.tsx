import { createApi } from "@/data/api/client";
import { CardContainer } from "@/components/ui/CardContainer";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { AuthedStackParamList } from "@/navigation/types";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Detail = {
  id: string;
  itemName: string;
  totalAmount: string;
  paidTotal: string;
  remaining: string;
  payments: {
    id: string;
    amount: string;
    paidAt: string;
    note?: string | null;
  }[];
  invoice: { fileUrl: string; originalName: string } | null;
};

type PaymentRoute = RouteProp<AuthedStackParamList, "Payment">;
type HistoryFilter = "ALL" | "TODAY" | "WEEK" | "MONTH";

export function PaymentScreen() {
  const { params } = useRoute<PaymentRoute>();
  const id = params.id;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const [row, setRow] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("ALL");

  function numberOnly(s: string) {
    return s.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  }

  const load = useCallback(async () => {
    const api = createApi(() => token);
    const d = await api.get<Detail>(`/requirements/${id}`);
    setRow(d);
  }, [id, token]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        setErr(null);
        await load();
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Could not load");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [load]);

  async function addPayment() {
    if (!row) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Enter valid payment amount");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const api = createApi(() => token);
      await api.post(`/requirements/${id}/payments`, { amount, note: paymentNote.trim() || undefined });
      await load();
      setPaymentAmount("");
      setPaymentNote("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add payment");
    } finally {
      setSaving(false);
    }
  }

  function isInSelectedDateRange(paidAt: string) {
    if (historyFilter === "ALL") return true;

    const now = new Date();
    const paymentDate = new Date(paidAt);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (historyFilter === "TODAY") {
      return paymentDate >= startOfToday;
    }

    if (historyFilter === "WEEK") {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - 6);
      return paymentDate >= startOfWeek;
    }

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return paymentDate >= startOfMonth;
  }

  const filteredPayments = row?.payments
    .filter((p) => isInSelectedDateRange(p.paidAt))
    .slice()
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  if (loading || !row) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.color.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.wrap,
        { paddingTop: tokens.space[2], paddingBottom: insets.bottom + tokens.space[4] },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>Payment</Text>
      <Text style={styles.screenTitle} numberOfLines={2}>
        {row.itemName}
      </Text>

      <View style={styles.kpiRow}>
        <CardContainer style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total</Text>
          <Text style={styles.kpiValue}>{row.totalAmount}</Text>
        </CardContainer>
        <CardContainer style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Paid</Text>
          <Text style={[styles.kpiValue, styles.success]}>{row.paidTotal}</Text>
        </CardContainer>
        <CardContainer style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Due</Text>
          <Text style={[styles.kpiValue, styles.negative]}>{row.remaining}</Text>
        </CardContainer>
      </View>

      {row.invoice ? (
        <CardContainer style={styles.block}>
          <Text style={styles.sectionTitle}>Invoice</Text>
          <Pressable style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]} onPress={() => Linking.openURL(row.invoice!.fileUrl)}>
            <Text style={styles.linkBtnText}>Open {row.invoice.originalName}</Text>
          </Pressable>
        </CardContainer>
      ) : (
        <Text style={styles.hint}>Invoice can be uploaded when editing the transaction.</Text>
      )}

      <CardContainer style={styles.block}>
        <Text style={styles.sectionTitle}>Add payment</Text>
        <Text style={styles.sectionHint}>Applied toward the remaining balance.</Text>
        <InputField
          label="Amount"
          placeholder="0"
          value={paymentAmount}
          onChangeText={(t) => setPaymentAmount(numberOnly(t))}
          keyboardType="decimal-pad"
        />
        <InputField
          label="Note"
          style={styles.inputNote}
          placeholder="Reference or remarks (optional)"
          value={paymentNote}
          onChangeText={setPaymentNote}
          multiline
        />
        <PrimaryButton title="Save payment" onPress={addPayment} disabled={saving} loading={saving} />
      </CardContainer>

      <CardContainer style={styles.block}>
        <Text style={styles.sectionTitle}>History</Text>
        <View style={styles.filterRow}>
          <Pressable
            style={({ pressed }) => [
              styles.filterChip,
              historyFilter === "ALL" && styles.filterChipOn,
              pressed && styles.pressed,
            ]}
            onPress={() => setHistoryFilter("ALL")}
          >
            <Text style={[styles.filterChipText, historyFilter === "ALL" && styles.filterChipTextOn]}>All</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.filterChip,
              historyFilter === "TODAY" && styles.filterChipOn,
              pressed && styles.pressed,
            ]}
            onPress={() => setHistoryFilter("TODAY")}
          >
            <Text style={[styles.filterChipText, historyFilter === "TODAY" && styles.filterChipTextOn]}>Today</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.filterChip,
              historyFilter === "WEEK" && styles.filterChipOn,
              pressed && styles.pressed,
            ]}
            onPress={() => setHistoryFilter("WEEK")}
          >
            <Text style={[styles.filterChipText, historyFilter === "WEEK" && styles.filterChipTextOn]}>This week</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.filterChip,
              historyFilter === "MONTH" && styles.filterChipOn,
              pressed && styles.pressed,
            ]}
            onPress={() => setHistoryFilter("MONTH")}
          >
            <Text style={[styles.filterChipText, historyFilter === "MONTH" && styles.filterChipTextOn]}>This month</Text>
          </Pressable>
        </View>
        {filteredPayments && filteredPayments.length ? (
          filteredPayments.map((p) => (
              <View key={p.id} style={styles.payRow}>
                <View style={styles.payTop}>
                  <Text style={styles.payAmt}>+ {p.amount}</Text>
                  <Text style={styles.payDate}>{new Date(p.paidAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.payTime}>{new Date(p.paidAt).toLocaleTimeString()}</Text>
                {p.note ? <Text style={styles.payNote}>{p.note}</Text> : null}
              </View>
            ))
        ) : (
          <Text style={styles.hint}>No payments found for selected date range.</Text>
        )}
      </CardContainer>

      {err ? <Text style={styles.err}>{err}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", backgroundColor: tokens.color.background },
  wrap: {
    paddingHorizontal: tokens.space[2],
    gap: tokens.space[2],
    backgroundColor: tokens.color.background,
  },
  kicker: {
    fontSize: tokens.textSize.caption,
    fontWeight: "700",
    color: tokens.color.accent,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  screenTitle: {
    fontSize: tokens.textSize.title,
    fontWeight: "700",
    color: tokens.color.text,
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: tokens.space[1],
  },
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
  success: { color: tokens.color.positive },
  negative: { color: tokens.color.negative },
  block: { gap: tokens.space[1] },
  sectionTitle: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "600",
    color: tokens.color.text,
    letterSpacing: -0.2,
  },
  sectionHint: { fontSize: tokens.textSize.caption, color: tokens.color.muted, marginTop: -4 },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space[1],
    marginTop: tokens.space[1],
  },
  filterChip: {
    paddingHorizontal: tokens.space[2],
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.panelMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  filterChipOn: {
    backgroundColor: tokens.color.accentMuted,
    borderColor: tokens.color.accent,
  },
  filterChipText: {
    color: tokens.color.text,
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
  },
  filterChipTextOn: {
    color: tokens.color.accent,
  },
  hint: { fontSize: tokens.textSize.small, color: tokens.color.muted, lineHeight: 20 },
  err: { color: tokens.color.negative, fontSize: tokens.textSize.small, fontWeight: "600", textAlign: "center" },
  inputNote: { minHeight: 80, textAlignVertical: "top" },
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
  payTime: { color: tokens.color.muted, fontSize: tokens.textSize.caption },
  payNote: { color: tokens.color.text, fontSize: tokens.textSize.caption },
  linkBtn: {
    alignSelf: "flex-start",
    marginTop: tokens.space[1],
    paddingHorizontal: tokens.space[2],
    paddingVertical: 12,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accentMuted,
 },
  linkBtnText: { fontWeight: "600", color: tokens.color.accent, fontSize: tokens.textSize.small },
  pressed: { opacity: 0.88 },
});
