import { createApi } from "@/data/api/client";
import { formatRupee, formatRupeeWithSign } from "@/core/formatRupee";
import { resolveFileUrl } from "@/core/resolveFileUrl";
import { CardContainer } from "@/components/ui/CardContainer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Snackbar } from "@/components/ui/Snackbar";
import type { AuthedStackParamList } from "@/navigation/types";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import DocumentPicker from "react-native-document-picker";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import Ionicons from "@react-native-vector-icons/ionicons";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Detail = {
  id: string;
  itemName: string;
  totalAmount: string;
  paidTotal: string;
  remaining: string;
  entryDate: string;
  vendor: { name: string };
  site: { name: string };
  brand?: string | null;
  notes?: string | null;
  payments: {
    id: string;
    amount: string;
    paidAt: string;
    note?: string | null;
  }[];
  invoice: { fileUrl: string; originalName: string } | null;
  billStatus?: "yes" | "no";
  billReceived?: boolean;
};

type InvoiceFile = { uri: string; type: string; name: string };

type PaymentRoute = RouteProp<AuthedStackParamList, "Payment">;
type HistoryFilter = "ALL" | "TODAY" | "WEEK" | "MONTH";

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

async function openInvoice(fileUrl: string) {
  const url = resolveFileUrl(fileUrl);
  await Linking.openURL(url);
}

export function PaymentScreen() {
  const { params } = useRoute<PaymentRoute>();
  const navigation = useNavigation<NavigationProp<AuthedStackParamList>>();
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
  const [billStatus, setBillStatus] = useState<"yes" | "no">("no");
  const [invoiceFile, setInvoiceFile] = useState<InvoiceFile | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function numberOnly(s: string) {
    return s.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  }

  const load = useCallback(async () => {
    const api = createApi(() => token);
    const d = await api.get<Detail>(`/requirements/${id}`);
    setRow(d);
    setBillStatus(d.billStatus ?? (d.billReceived ? "yes" : "no"));
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
    const due = Number(row.remaining) || 0;
    if (amount > due + 0.001) {
      setErr(`Amount exceeds Due (${formatRupee(row.remaining)})`);
      return;
    }
    setSaving(true);
    setErr(null);
    setConfirmOpen(false);
    try {
      const api = createApi(() => token);
      await api.post(`/requirements/${id}/payments`, {
        amount,
        note: paymentNote.trim() || undefined,
        billStatus,
      });

      if (billStatus === "yes" && invoiceFile) {
        if (!token) throw new Error("Not signed in");
        const formData = new FormData();
        const filePayload = {
          uri: invoiceFile.uri,
          type: invoiceFile.type,
          name: invoiceFile.name,
        };
        formData.append("file", filePayload as unknown as Blob);
        await api.postForm(`/requirements/${id}/invoice`, formData);
      }

      navigation.goBack();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add payment");
    } finally {
      setSaving(false);
    }
  }

  function requestSavePayment() {
    if (!row) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Enter valid payment amount");
      return;
    }
    const due = Number(row.remaining) || 0;
    if (amount > due + 0.001) {
      setErr(`Amount exceeds Due (${formatRupee(row.remaining)})`);
      return;
    }
    setConfirmOpen(true);
  }

  async function pickInvoice() {
    Alert.alert("Attach bill", "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
          const res = await launchCamera({ mediaType: "photo", cameraType: "back", quality: 0.8 });
          if (res.didCancel) return;
          if (res.errorCode) {
            setErr("Could not open camera");
            return;
          }
          const asset = res.assets?.[0];
          if (asset?.uri) {
            setInvoiceFile({
              uri: asset.uri,
              type: asset.type || "image/jpeg",
              name: asset.fileName || "bill.jpg",
            });
          }
        },
      },
      {
        text: "Gallery",
        onPress: async () => {
          const res = await launchImageLibrary({ mediaType: "photo", selectionLimit: 1, quality: 0.8 });
          if (res.didCancel) return;
          if (res.errorCode) {
            setErr("Could not open gallery");
            return;
          }
          const asset = res.assets?.[0];
          if (asset?.uri) {
            setInvoiceFile({
              uri: asset.uri,
              type: asset.type || "image/jpeg",
              name: asset.fileName || "bill.jpg",
            });
          }
        },
      },
      {
        text: "Document",
        onPress: async () => {
          try {
            const file = await DocumentPicker.pickSingle({
              type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
            });
            if (!file.uri) return;
            setInvoiceFile({
              uri: file.uri,
              type: file.type || "application/octet-stream",
              name: file.name || "invoice",
            });
          } catch (e) {
            if (DocumentPicker.isCancel(e)) return;
            setErr("Failed to select invoice file");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.color.accent} />
      </View>
    );
  }

  if (!row) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>{err || "Could not load payment"}</Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => {
            setLoading(true);
            void load()
              .catch((e) => setErr(e instanceof Error ? e.message : "Could not load"))
              .finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Snackbar message={err} onDismiss={() => setErr(null)} />
      <ConfirmDialog
        visible={confirmOpen}
        title="Confirm payment"
        message={`Pay ${formatRupee(paymentAmount)} against Due ${formatRupee(row.remaining)}?`}
        confirmLabel="Pay now"
        onConfirm={() => void addPayment()}
        onCancel={() => setConfirmOpen(false)}
      />
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
          <Text style={styles.kpiValue}>{formatRupee(row.totalAmount)}</Text>
        </CardContainer>
        <CardContainer style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Paid</Text>
          <Text style={[styles.kpiValue, styles.success]}>{formatRupee(row.paidTotal)}</Text>
        </CardContainer>
        <CardContainer style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Due</Text>
          <Text style={[styles.kpiValue, styles.negative]}>{formatRupee(row.remaining)}</Text>
        </CardContainer>
      </View>

      <CardContainer style={styles.block}>
        <Text style={styles.sectionTitle}>Transaction details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Entry date</Text>
          <Text style={styles.detailValue}>{formatEntryDate(row.entryDate)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Vendor</Text>
          <Text style={styles.detailValue}>{row.vendor?.name ?? "—"}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Site</Text>
          <Text style={styles.detailValue}>{row.site?.name ?? "—"}</Text>
        </View>
        {row.brand?.trim() ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Brand</Text>
            <Text style={styles.detailValue}>{row.brand.trim()}</Text>
          </View>
        ) : null}
        {row.notes?.trim() ? (
          <View style={styles.detailRowMultiline}>
            <Text style={styles.detailLabel}>Notes</Text>
            <Text style={styles.detailValueMultiline}>{row.notes.trim()}</Text>
          </View>
        ) : null}
      </CardContainer>

      {row.invoice ? (
        <CardContainer style={styles.block}>
          <Text style={styles.sectionTitle}>Invoice</Text>
          <Pressable
            style={({ pressed }) => [styles.invoiceAction, pressed && styles.pressed]}
            onPress={() => openInvoice(row.invoice!.fileUrl).catch(() => setErr("Could not open invoice"))}
          >
            <Ionicons name="document-text-outline" size={18} color={tokens.color.accent} />
            <Text style={styles.invoiceActionText} numberOfLines={1}>
              View {row.invoice.originalName}
            </Text>
            <Ionicons name="open-outline" size={16} color={tokens.color.accent} />
          </Pressable>
        </CardContainer>
      ) : (
        <Text style={styles.hint}>You can optionally upload invoice while adding a payment.</Text>
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
        <View style={styles.filterRow}>
          <Pressable
            style={({ pressed }) => [styles.filterChip, billStatus === "no" && styles.filterChipOn, pressed && styles.pressed]}
            onPress={() => setBillStatus("no")}
          >
            <Text style={[styles.filterChipText, billStatus === "no" && styles.filterChipTextOn]}>Bill: No</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.filterChip, billStatus === "yes" && styles.filterChipOn, pressed && styles.pressed]}
            onPress={() => setBillStatus("yes")}
          >
            <Text style={[styles.filterChipText, billStatus === "yes" && styles.filterChipTextOn]}>Bill: Yes</Text>
          </Pressable>
        </View>
        {billStatus === "yes" ? (
          <View style={styles.invoiceUploadRow}>
            <Pressable
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
              onPress={pickInvoice}
              disabled={saving}
            >
              <Text style={styles.linkBtnText}>{invoiceFile ? "Replace bill" : "Take / upload bill"}</Text>
            </Pressable>
            {invoiceFile ? <Text style={styles.fileName}>Selected: {invoiceFile.name}</Text> : null}
          </View>
        ) : null}
        <PrimaryButton title="Save payment" onPress={requestSavePayment} disabled={saving} loading={saving} />
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
                  <Text style={styles.payAmt}>{formatRupeeWithSign(p.amount, "+")}</Text>
                  <Text style={styles.payDate}>{new Date(p.paidAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.payTime}>{new Date(p.paidAt).toLocaleTimeString()}</Text>
                {p.note ? <Text style={styles.payNote}>{p.note}</Text> : null}
                {row.invoice && p.id === filteredPayments[0]?.id ? (
                  <Pressable
                    style={({ pressed }) => [styles.invoiceAction, styles.invoiceActionInline, pressed && styles.pressed]}
                    onPress={() => openInvoice(row.invoice!.fileUrl).catch(() => setErr("Could not open invoice"))}
                  >
                    <Ionicons name="document-text-outline" size={16} color={tokens.color.accent} />
                    <Text style={styles.invoiceActionText} numberOfLines={1}>
                      View invoice · {row.invoice.originalName}
                    </Text>
                    <Ionicons name="download-outline" size={16} color={tokens.color.accent} />
                  </Pressable>
                ) : null}
              </View>
            ))
        ) : (
          <Text style={styles.hint}>No payments found for selected date range.</Text>
        )}
      </CardContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: tokens.space[2],
    padding: tokens.space[3],
    backgroundColor: tokens.color.background,
  },
  retryBtn: {
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 8,
    backgroundColor: tokens.color.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  retryText: { color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
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
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.space[2],
    paddingVertical: 2,
  },
  detailRowMultiline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.space[2],
    paddingVertical: 2,
  },
  detailLabel: {
    flexShrink: 0,
    maxWidth: "42%",
    fontSize: tokens.textSize.caption,
    color: tokens.color.muted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: tokens.textSize.small,
    color: tokens.color.text,
    fontWeight: "500",
    lineHeight: 20,
  },
  detailValueMultiline: {
    flex: 1,
    textAlign: "right",
    fontSize: tokens.textSize.small,
    color: tokens.color.text,
    fontWeight: "500",
    lineHeight: 20,
  },
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
  invoiceAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: tokens.space[1],
    paddingHorizontal: tokens.space[2],
    paddingVertical: 10,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accentMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.accent,
  },
  invoiceActionInline: { marginTop: 8 },
  invoiceActionText: {
    flex: 1,
    fontWeight: "600",
    color: tokens.color.accent,
    fontSize: tokens.textSize.caption,
  },
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
  invoiceUploadRow: { marginTop: tokens.space[1], gap: tokens.space[1] },
  fileName: { fontSize: tokens.textSize.caption, color: tokens.color.muted },
});
