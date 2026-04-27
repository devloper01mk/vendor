import { createApi } from "@/data/api/client";
import { config } from "@/core/config";
import { CardContainer } from "@/components/ui/CardContainer";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { tokens } from "@/theme/tokens";
import DocumentPicker from "react-native-document-picker";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Opt = { id: string; name: string };
type InvoiceFile = { uri: string; type: string; name: string };

function numberOnly(s: string) {
  return s.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

export function AddEntryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthedStackParamList>>();
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();

  const [vendors, setVendors] = useState<Opt[]>([]);
  const [sites, setSites] = useState<Opt[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [itemName, setItemName] = useState("");
  const [brand, setBrand] = useState("");
  const [total, setTotal] = useState("");
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<InvoiceFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [vendorSheetOpen, setVendorSheetOpen] = useState(false);
  const [vendorBusy, setVendorBusy] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorAltPhone, setVendorAltPhone] = useState("");
  const [vendorGst, setVendorGst] = useState("");
  const [siteSheetOpen, setSiteSheetOpen] = useState(false);
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [errors, setErrors] = useState<{ item?: string; total?: string }>({});

  useEffect(() => {
    let c = false;
    (async () => {
      const api = createApi(() => token);
      const [v, s] = await Promise.all([
        api.get<{ id: string; name: string }[]>("/vendors"),
        api.get<{ id: string; name: string }[]>("/sites"),
      ]);
      if (!c) {
        setVendors(v.map((x) => ({ id: x.id, name: x.name })));
        setSites(s.map((x) => ({ id: x.id, name: x.name })));
        if (v[0]) setVendorId(v[0].id);
        if (s[0]) setSiteId(s[0].id);
      }
    })();
    return () => {
      c = true;
    };
  }, [token]);

  async function pickInvoice() {
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
    } catch (error) {
      if (DocumentPicker.isCancel(error)) return;
      setStatus("Failed to select invoice file");
    }
  }

  async function uploadInvoice(requirementId: string) {
    if (!invoiceFile || !token) return;

    const formData = new FormData();
    formData.append("file", {
      uri: invoiceFile.uri,
      type: invoiceFile.type,
      name: invoiceFile.name,
    } as unknown as Blob);

    const res = await fetch(`${config.apiUrl}/requirements/${requirementId}/invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-client-platform": "mobile",
        Accept: "application/json",
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Invoice upload failed");
    }
  }

  function validate(): boolean {
    const next: { item?: string; total?: string } = {};
    if (!itemName.trim()) next.item = "Enter a short description of the purchase.";
    const n = Number(total);
    if (!total.trim() || !Number.isFinite(n) || n <= 0) next.total = "Enter a valid total greater than zero.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    setStatus(null);
    try {
      const api = createApi(() => token);
      const entryDate = new Date().toISOString();
      const row = await api.post<{ id: string }>("/requirements", {
        vendorId,
        siteId,
        itemName: itemName.trim(),
        brand: brand.trim() || undefined,
        quantity: 1,
        totalAmount: Number(total),
        entryDate,
        status: "PENDING",
        billReceived: false,
        notes: note.trim() || undefined,
      });
      const paidAmount = Number(paid);
      if (paid && Number.isFinite(paidAmount) && paidAmount > 0) {
        await api.post(`/requirements/${row.id}/payments`, { amount: paidAmount, note: note.trim() || undefined });
      }
      if (invoiceFile) {
        await uploadInvoice(row.id);
      }
      setStatus("Saved");
      setItemName("");
      setBrand("");
      setTotal("");
      setPaid("");
      setNote("");
      setInvoiceFile(null);
      setErrors({});
      navigation.goBack();
    } catch {
      setStatus("Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function addVendorFromSheet() {
    if (!vendorName.trim()) return;
    setVendorBusy(true);
    setStatus(null);
    try {
      const api = createApi(() => token);
      const created = await api.post<{ id: string; name: string }>("/vendors", {
        name: vendorName.trim(),
        phone: vendorPhone || undefined,
        alternatePhone: vendorAltPhone || undefined,
        gstNumber: vendorGst || undefined,
      });
      const list = await api.get<{ id: string; name: string }[]>("/vendors");
      setVendors(list.map((x) => ({ id: x.id, name: x.name })));
      setVendorId(created.id);
      setVendorName("");
      setVendorPhone("");
      setVendorAltPhone("");
      setVendorGst("");
      setVendorSheetOpen(false);
    } catch {
      setStatus("Failed to add vendor");
    } finally {
      setVendorBusy(false);
    }
  }

  async function addSiteFromSheet() {
    if (!siteName.trim()) return;
    setSiteBusy(true);
    setStatus(null);
    try {
      const api = createApi(() => token);
      const created = await api.post<{ id: string; name: string }>("/sites", {
        name: siteName.trim(),
        code: siteCode || undefined,
        address: siteAddress || undefined,
      });
      const list = await api.get<{ id: string; name: string }[]>("/sites");
      setSites(list.map((x) => ({ id: x.id, name: x.name })));
      setSiteId(created.id);
      setSiteName("");
      setSiteCode("");
      setSiteAddress("");
      setSiteSheetOpen(false);
    } catch {
      setStatus("Failed to add site");
    } finally {
      setSiteBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.wrap,
        { paddingTop: tokens.space[2], paddingBottom: insets.bottom + tokens.space[4] },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.screenTitle}>Add Transaction</Text>

      <CardContainer style={styles.card}>
        <Text style={styles.cardTitle}>Type</Text>
        <Field label="Vendor">
          <View style={styles.vendorRow}>
            <View style={styles.vendorPickerWrap}>
              <PickerLike options={vendors} value={vendorId} onChange={setVendorId} />
            </View>
            <Pressable
              style={({ pressed }) => [styles.addCircleBtn, pressed && styles.pressed]}
              onPress={() => setVendorSheetOpen(true)}
              hitSlop={8}
            >
              <Text style={styles.addCircleBtnText}>+</Text>
            </Pressable>
          </View>
        </Field>
        <Field label="From / To">
          <View style={styles.vendorRow}>
            <View style={styles.vendorPickerWrap}>
              <PickerLike options={sites} value={siteId} onChange={setSiteId} />
            </View>
            <Pressable
              style={({ pressed }) => [styles.addCircleBtn, pressed && styles.pressed]}
              onPress={() => setSiteSheetOpen(true)}
              hitSlop={8}
            >
              <Text style={styles.addCircleBtnText}>+</Text>
            </Pressable>
          </View>
        </Field>
      </CardContainer>

      <CardContainer style={styles.card}>
        <Text style={styles.cardTitle}>Amount</Text>
        <InputField
          label="Item"
          value={itemName}
          onChangeText={(t) => {
            setItemName(t);
            if (errors.item) setErrors((e) => ({ ...e, item: undefined }));
          }}
          placeholder="e.g. Electrical wire, switches"
          error={errors.item}
        />
        <InputField
          label="Brand / source"
          value={brand}
          onChangeText={setBrand}
          placeholder="Optional — Amazon, local market…"
        />
        <View style={styles.amountRow}>
          <View style={styles.amountHalf}>
            <InputField
              label="Amount"
              value={total}
              onChangeText={(t) => {
                setTotal(numberOnly(t));
                if (errors.total) setErrors((e) => ({ ...e, total: undefined }));
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              error={errors.total}
              containerStyle={styles.amountField}
            />
          </View>
          <View style={styles.amountHalf}>
            <InputField
              label="Paid now"
              value={paid}
              onChangeText={(t) => setPaid(numberOnly(t))}
              keyboardType="decimal-pad"
              placeholder="0"
              helperText="Optional partial payment"
              containerStyle={styles.amountField}
            />
          </View>
        </View>
        <InputField
          label="Note (Optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Enter note"
          multiline
          style={styles.inputNote}
        />
      </CardContainer>

      <CardContainer style={styles.card}>
        <Text style={styles.cardTitle}>Invoice</Text>
        <Text style={styles.cardHint}>Attach a PDF or photo for your records.</Text>
        <Pressable style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]} onPress={pickInvoice}>
          <Text style={styles.chipText}>{invoiceFile ? "Replace file" : "Choose PDF or image"}</Text>
        </Pressable>
        {invoiceFile ? <Text style={styles.fileName}>Selected: {invoiceFile.name}</Text> : null}
      </CardContainer>

      {status ? (
        <Text style={[styles.status, status === "Failed to save" ? styles.statusErr : null]}>{status}</Text>
      ) : null}

      <PrimaryButton title="Save Transaction" onPress={save} disabled={busy} loading={busy} />

      <Modal visible={vendorSheetOpen} animationType="slide" transparent onRequestClose={() => setVendorSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setVendorSheetOpen(false)} />
          <CardContainer style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>New vendor</Text>
            <InputField label="Name" placeholder="Vendor name" value={vendorName} onChangeText={setVendorName} />
            <InputField label="Phone" placeholder="Primary phone" value={vendorPhone} onChangeText={setVendorPhone} keyboardType="phone-pad" />
            <InputField
              label="Alternate phone"
              placeholder="Optional"
              value={vendorAltPhone}
              onChangeText={setVendorAltPhone}
              keyboardType="phone-pad"
            />
            <InputField label="GST number" placeholder="Optional" value={vendorGst} onChangeText={setVendorGst} />
            <PrimaryButton
              title="Add vendor"
              onPress={addVendorFromSheet}
              disabled={vendorBusy || !vendorName.trim()}
              loading={vendorBusy}
            />
          </CardContainer>
        </View>
      </Modal>

      <Modal visible={siteSheetOpen} animationType="slide" transparent onRequestClose={() => setSiteSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setSiteSheetOpen(false)} />
          <CardContainer style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>New site</Text>
            <InputField label="Site name" placeholder="Name" value={siteName} onChangeText={setSiteName} />
            <InputField label="Code" placeholder="Optional site code" value={siteCode} onChangeText={setSiteCode} />
            <InputField label="Address" placeholder="Optional" value={siteAddress} onChangeText={setSiteAddress} />
            <PrimaryButton title="Add site" onPress={addSiteFromSheet} disabled={siteBusy || !siteName.trim()} loading={siteBusy} />
          </CardContainer>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PickerLike({
  options,
  value,
  onChange,
}: {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.pickerRow}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onChange(o.id)}
          style={({ pressed }) => [styles.chip, value === o.id && styles.chipOn, pressed && styles.chipPressed]}
        >
          <Text style={[styles.chipText, value === o.id && styles.chipTextOn]} numberOfLines={1}>
            {o.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: tokens.textSize.hero,
    fontWeight: "700",
    color: tokens.color.text,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  screenSub: { fontSize: tokens.textSize.small, color: tokens.color.muted, fontWeight: "500", marginBottom: tokens.space[1] },
  card: { gap: tokens.space[1] },
  cardTitle: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "600",
    color: tokens.color.text,
    marginBottom: tokens.space[1],
    letterSpacing: -0.2,
  },
  cardHint: { fontSize: tokens.textSize.caption, color: tokens.color.muted, marginTop: -4, marginBottom: tokens.space[1] },
  fieldBlock: { marginBottom: tokens.space[2] },
  fieldLabel: {
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
    color: tokens.color.muted,
    marginBottom: tokens.space[1],
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  vendorRow: { flexDirection: "row", alignItems: "flex-start", gap: tokens.space[1] },
  vendorPickerWrap: { flex: 1 },
  addCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panelMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  addCircleBtnText: { fontSize: 22, lineHeight: 24, color: tokens.color.accent, fontWeight: "600" },
  pressed: { opacity: 0.85 },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space[1] },
  chip: {
    paddingHorizontal: tokens.space[2],
    paddingVertical: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.panelMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    maxWidth: "100%",
  },
  chipOn: { backgroundColor: tokens.color.accentMuted, borderColor: tokens.color.accent },
  chipPressed: { opacity: 0.9 },
  chipText: { fontSize: tokens.textSize.small, color: tokens.color.text, fontWeight: "500" },
  chipTextOn: { color: tokens.color.accent, fontWeight: "700" },
  amountRow: { flexDirection: "row", gap: tokens.space[2] },
  amountHalf: { flex: 1 },
  amountField: { marginBottom: 0 },
  inputNote: { minHeight: 96, textAlignVertical: "top" },
  fileName: { fontSize: tokens.textSize.caption, color: tokens.color.muted, marginTop: tokens.space[1] },
  status: { textAlign: "center", fontSize: tokens.textSize.small, color: tokens.color.muted },
  statusErr: { color: tokens.color.negative, fontWeight: "600" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: tokens.color.overlay },
  sheetCard: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: tokens.space[4],
    maxHeight: "88%",
    gap: 0,
  },
  sheetTitle: {
    fontSize: tokens.textSize.subtitle,
    lineHeight: 24,
    fontWeight: "600",
    color: tokens.color.text,
    marginBottom: tokens.space[2],
    letterSpacing: -0.2,
  },
});
