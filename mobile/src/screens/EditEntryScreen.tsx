import { createApi } from "@/data/api/client";
import { config } from "@/core/config";
import { CardContainer } from "@/components/ui/CardContainer";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DocumentPicker from "react-native-document-picker";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Opt = { id: string; name: string };
type InvoiceFile = { uri: string; type: string; name: string };

type Detail = {
  id: string;
  itemName: string;
  brand: string | null;
  totalAmount: string;
  paidTotal: string;
  billStatus?: "yes" | "no";
  billReceived?: boolean;
  invoice: { fileUrl: string; originalName: string } | null;
  notes: string | null;
  vendor: { id: string; name: string };
  site: { id: string; name: string };
  createdBy: { id: string };
};

type R = RouteProp<AuthedStackParamList, "EditEntry">;

function numberOnly(s: string) {
  return s.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

export function EditEntryScreen() {
  const { params } = useRoute<R>();
  const id = params.id;
  const navigation = useNavigation<NativeStackNavigationProp<AuthedStackParamList>>();
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [vendors, setVendors] = useState<Opt[]>([]);
  const [sites, setSites] = useState<Opt[]>([]);

  const [vendorId, setVendorId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [itemName, setItemName] = useState("");
  const [brand, setBrand] = useState("");
  const [total, setTotal] = useState("");
  const [note, setNote] = useState("");
  const [paidTotal, setPaidTotal] = useState("0");
  const [paidTotalOriginal, setPaidTotalOriginal] = useState("0");
  const [invoice, setInvoice] = useState<Detail["invoice"]>(null);
  const [billStatus, setBillStatus] = useState<"yes" | "no">("no");
  const [invoiceFile, setInvoiceFile] = useState<InvoiceFile | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ item?: string; total?: string; vendor?: string; site?: string }>({});
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

  const canEdit = useMemo(() => (me?.id && ownerId ? me.id === ownerId : false), [me?.id, ownerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = createApi(() => token);
        const [v, s, d] = await Promise.all([
          api.get<{ id: string; name: string }[]>("/vendors"),
          api.get<{ id: string; name: string }[]>("/sites"),
          api.get<Detail>(`/requirements/${id}`),
        ]);
        if (cancelled) return;
        setVendors(v.map((x) => ({ id: x.id, name: x.name })));
        setSites(s.map((x) => ({ id: x.id, name: x.name })));
        setOwnerId(d.createdBy.id);
        setVendorId(d.vendor.id);
        setSiteId(d.site.id);
        setItemName(d.itemName);
        setBrand(d.brand ?? "");
        setTotal(String(d.totalAmount ?? ""));
        setNote(d.notes ?? "");
        setPaidTotal(d.paidTotal ?? "0");
        setPaidTotalOriginal(d.paidTotal ?? "0");
        setInvoice(d.invoice ?? null);
        setBillStatus(d.billStatus ?? (d.billReceived ? "yes" : "no"));
      } catch {
        if (!cancelled) setStatus("Could not load transaction");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  async function pickInvoice() {
    Alert.alert("Attach bill", "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
          const res = await launchCamera({ mediaType: "photo", cameraType: "back", quality: 0.8 });
          if (res.didCancel) return;
          if (res.errorCode) {
            setStatus("Could not open camera");
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
            setStatus("Could not open gallery");
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
          } catch (error) {
            if (DocumentPicker.isCancel(error)) return;
            setStatus("Failed to select invoice file");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
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
      setStatus("Failed to add brand/person");
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
    const next: { item?: string; total?: string; vendor?: string; site?: string } = {};
    if (!vendorId) next.vendor = "Select a brand/person";
    if (!siteId) next.site = "Select a site";
    if (!itemName.trim()) next.item = "Item description is required.";
    const n = Number(total);
    if (!total.trim() || !Number.isFinite(n) || n <= 0) next.total = "Enter a valid total.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!canEdit) return;
    if (!validate()) return;
    setBusy(true);
    setStatus(null);
    try {
      const api = createApi(() => token);
      const paidNext = Number(paidTotal || "0");
      const paidPrev = Number(paidTotalOriginal || "0");
      if (!Number.isFinite(paidNext) || paidNext < 0) {
        setStatus("Paid amount must be a valid number");
        return;
      }
      if (paidNext < paidPrev) {
        setStatus("Paid amount cannot be reduced from this screen");
        return;
      }
      await api.patch(`/requirements/${id}`, {
        vendorId,
        siteId,
        itemName: itemName.trim(),
        brand: brand.trim() || undefined,
        quantity: 1,
        totalAmount: Number(total),
        entryDate: new Date().toISOString(),
        billStatus,
        notes: note.trim() || undefined,
      });
      const delta = paidNext - paidPrev;
      if (delta > 0) {
        await api.post(`/requirements/${id}/payments`, { amount: delta, note: note.trim() || undefined });
      }
      if (billStatus === "yes" && invoiceFile) {
        await uploadInvoice(id);
      }
      navigation.goBack();
    } catch {
      setStatus("Failed to save changes");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
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
      <Text style={styles.kicker}>Edit</Text>
      <Text style={styles.screenTitle}>Transaction</Text>
      <Text style={styles.screenSub}>Update details or record additional paid amount.</Text>

      {!canEdit ? (
        <CardContainer style={styles.banner}>
          <Text style={styles.bannerTitle}>Read-only</Text>
          <Text style={styles.bannerMsg}>You can only edit entries you created.</Text>
        </CardContainer>
      ) : null}

      <CardContainer style={styles.card}>
        <Text style={styles.cardTitle}>Parties</Text>
        <SearchableSelect
          label="Brand/Person"
          options={vendors}
          value={vendorId}
          placeholder="Select brand/person"
          searchPlaceholder="Search brand/person..."
          disabled={!canEdit}
          error={errors.vendor}
          onChange={(id) => {
            setVendorId(id);
            if (errors.vendor) setErrors((e) => ({ ...e, vendor: undefined }));
          }}
          onAddPress={canEdit ? () => setVendorSheetOpen(true) : undefined}
        />
        <SearchableSelect
          label="Site"
          options={sites}
          value={siteId}
          placeholder="Select site"
          searchPlaceholder="Search site..."
          disabled={!canEdit}
          error={errors.site}
          onChange={(id) => {
            setSiteId(id);
            if (errors.site) setErrors((e) => ({ ...e, site: undefined }));
          }}
          onAddPress={canEdit ? () => setSiteSheetOpen(true) : undefined}
        />
      </CardContainer>

      <CardContainer style={styles.card}>
        <Text style={styles.cardTitle}>Line item</Text>
        <InputField
          label="Item"
          value={itemName}
          onChangeText={(t) => {
            setItemName(t);
            if (errors.item) setErrors((e) => ({ ...e, item: undefined }));
          }}
          editable={canEdit}
          error={errors.item}
        />
        <InputField label="Details" value={brand} onChangeText={setBrand} editable={canEdit} />
        <View style={styles.amountRow}>
          <View style={styles.amountHalf}>
            <InputField
              label="Total amount"
              value={total}
              onChangeText={(t) => {
                setTotal(numberOnly(t));
                if (errors.total) setErrors((e) => ({ ...e, total: undefined }));
              }}
              keyboardType="decimal-pad"
              editable={canEdit}
              error={errors.total}
              containerStyle={styles.amountField}
            />
          </View>
          <View style={styles.amountHalf}>
            <InputField
              label="Paid total"
              value={paidTotal}
              onChangeText={(t) => setPaidTotal(numberOnly(t))}
              keyboardType="decimal-pad"
              editable={canEdit}
              helperText="Increase to add a payment"
              containerStyle={styles.amountField}
            />
          </View>
        </View>
      </CardContainer>

      <CardContainer style={styles.card}>
        <Text style={styles.cardTitle}>Bill status</Text>
        <View style={styles.pickerRow}>
          <Pressable
            style={({ pressed }) => [styles.chip, billStatus === "no" && styles.chipOn, pressed && styles.chipPressed]}
            onPress={() => setBillStatus("no")}
            disabled={!canEdit}
          >
            <Text style={[styles.chipText, billStatus === "no" && styles.chipTextOn]}>No</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.chip, billStatus === "yes" && styles.chipOn, pressed && styles.chipPressed]}
            onPress={() => setBillStatus("yes")}
            disabled={!canEdit}
          >
            <Text style={[styles.chipText, billStatus === "yes" && styles.chipTextOn]}>Yes</Text>
          </Pressable>
        </View>
      </CardContainer>

      <CardContainer style={styles.card}>
        <Text style={styles.cardTitle}>Invoice</Text>
        {invoice ? (
          <Pressable style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]} onPress={() => Linking.openURL(invoice.fileUrl)}>
            <Text style={styles.linkBtnText}>Open current file ({invoice.originalName})</Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>No invoice on file yet.</Text>
        )}
        {billStatus === "yes" ? (
          <Pressable style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]} onPress={pickInvoice} disabled={!canEdit}>
            <Text style={styles.linkBtnText}>{invoiceFile ? `Replace with ${invoiceFile.name}` : "Upload or replace"}</Text>
          </Pressable>
        ) : null}
      </CardContainer>

      <CardContainer style={styles.card}>
        <InputField
          label="Note"
          value={note}
          onChangeText={setNote}
          multiline
          editable={canEdit}
          style={styles.inputNote}
        />
      </CardContainer>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <PrimaryButton title="Save changes" onPress={save} disabled={busy || !canEdit} loading={busy} />

      <Modal visible={vendorSheetOpen} animationType="slide" transparent onRequestClose={() => setVendorSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setVendorSheetOpen(false)} />
          <CardContainer style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>New brand/person</Text>
            <InputField label="Name" placeholder="Name" value={vendorName} onChangeText={setVendorName} />
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
              title="Add"
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

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", backgroundColor: tokens.color.background },
  wrap: { paddingHorizontal: tokens.space[2], gap: tokens.space[2], backgroundColor: tokens.color.background },
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
  banner: {
    gap: tokens.space[1],
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panelMuted,
  },
  bannerTitle: { color: tokens.color.negative, fontWeight: "700", fontSize: tokens.textSize.small },
  bannerMsg: { color: tokens.color.muted, fontSize: tokens.textSize.caption, lineHeight: 18 },
  card: { gap: tokens.space[2] },
  cardTitle: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "600",
    color: tokens.color.text,
    letterSpacing: -0.2,
  },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space[1] },
  chip: {
    paddingHorizontal: tokens.space[2],
    paddingVertical: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.panelMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  chipOn: { backgroundColor: tokens.color.accentMuted, borderColor: tokens.color.accent },
  chipPressed: { opacity: 0.9 },
  chipText: { fontSize: tokens.textSize.small, color: tokens.color.text, fontWeight: "500" },
  chipTextOn: { color: tokens.color.accent, fontWeight: "700" },
  amountRow: { flexDirection: "row", gap: tokens.space[2] },
  amountHalf: { flex: 1 },
  amountField: { marginBottom: 0 },
  hint: { fontSize: tokens.textSize.small, color: tokens.color.muted },
  linkBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: tokens.space[2],
    paddingVertical: 12,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panelMuted,
    marginBottom: tokens.space[1],
  },
  linkBtnText: { fontWeight: "600", color: tokens.color.accent, fontSize: tokens.textSize.small },
  pressed: { opacity: 0.88 },
  inputNote: { minHeight: 96, textAlignVertical: "top" },
  status: { textAlign: "center", fontSize: tokens.textSize.small, color: tokens.color.negative, fontWeight: "600" },
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
