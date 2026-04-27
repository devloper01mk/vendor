import { createApi } from "@/data/api/client";
import { CardContainer } from "@/components/ui/CardContainer";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import type { AuthedStackParamList } from "@/navigation/types";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Site = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  metrics?: {
    totalSpent: string;
    transactions: number;
    status: "ACTIVE" | "INACTIVE";
  };
};

export function SitesScreen() {
  const token = useAuthStore((s) => s.token);
  const navigation = useNavigation<NavigationProp<AuthedStackParamList>>();
  const [rows, setRows] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [siteStatus, setSiteStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  async function loadData() {
    const api = createApi(() => token);
    const data = await api.get<Site[]>("/sites");
    setRows(data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = createApi(() => token);
        const data = await api.get<Site[]>("/sites");
        if (!cancelled) {
          setRows(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onAddSite() {
    setBusy(true);
    setStatus(null);
    try {
      const api = createApi(() => token);
      if (editingSiteId) {
        await api.patch(`/sites/${editingSiteId}`, {
          name,
          code: code || undefined,
          address: address || undefined,
        });
      } else {
        await api.post("/sites", { name, code: code || undefined, address: address || undefined });
      }
      setName("");
      setCode("");
      setAddress("");
      setEditingSiteId(null);
      await loadData();
      setStatus(editingSiteId ? "Site updated" : "Site added");
      setSheetOpen(false);
    } catch {
      setStatus(editingSiteId ? "Failed to update site" : "Failed to add site");
    } finally {
      setBusy(false);
    }
  }

  function openAddSheet() {
    setEditingSiteId(null);
    setName("");
    setCode("");
    setAddress("");
    setSiteStatus("ACTIVE");
    setStatus(null);
    setSheetOpen(true);
  }

  function openEditSheet(s: Site) {
    setEditingSiteId(s.id);
    setName(s.name ?? "");
    setCode(s.code ?? "");
    setAddress(s.address ?? "");
    setSiteStatus(s.metrics?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE");
    setStatus(null);
    setSheetOpen(true);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.topRow}>
              <Pressable style={styles.topIconBtn}>
                <Text style={styles.topIcon}>☰</Text>
              </Pressable>
              <Text style={styles.topTitle}>Sites</Text>
              <View style={styles.topRight}>
                <Pressable style={styles.topIconBtn}>
                  <Text style={styles.topIcon}>◌</Text>
                </Pressable>
                <Pressable style={styles.avatar} onPress={() => navigation.navigate("Settings")}>
                  <Text style={styles.avatarText}>AS</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <Text style={styles.searchText}>Search sites...</Text>
              </View>
              <Pressable style={styles.addInlineBtn} onPress={openAddSheet}>
                <Text style={styles.addInlineBtnText}>+ Add Site</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable style={styles.siteCard}>
            <View style={styles.siteIconWrap}>
              <Text style={styles.siteIcon}>{["⌂", "◫", "◨", "◉"][index % 4]}</Text>
            </View>
            <View style={styles.siteMiddle}>
              <Text style={styles.siteName}>{item.name}</Text>
              <Text style={styles.siteMeta}>Total Spent</Text>
              <Text style={styles.siteValue}>₹ {item.metrics?.totalSpent ?? "0"}</Text>
            </View>
            <View style={styles.siteRight}>
              <Text style={styles.siteMeta}>Transactions</Text>
              <Text style={styles.siteValueSmall}>{item.metrics?.transactions ?? 0}</Text>
              <View style={styles.statusPill}>
                <Text
                  style={[
                    styles.statusPillText,
                    item.metrics?.status === "INACTIVE" ? styles.statusPillTextInactive : null,
                  ]}
                >
                  {item.metrics?.status === "INACTIVE" ? "Inactive" : "Active"}
                </Text>
              </View>
              <Pressable style={styles.editBtn} onPress={() => openEditSheet(item)} hitSlop={8}>
                <Text style={styles.editIcon}>✎</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No sites</Text>}
      />

      <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
          <CardContainer style={styles.sheet}>
            <View style={styles.formHeaderRow}>
              <Pressable style={styles.uploadTile}>
                <Text style={styles.uploadTileIcon}>⌖</Text>
                <Text style={styles.uploadTileText}>Upload Icon</Text>
              </Pressable>
              <View style={styles.formHeaderFields}>
                <InputField label="Site Name" placeholder="Enter site name" value={name} onChangeText={setName} />
                <InputField
                  label="Description (Optional)"
                  placeholder="Enter description"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  numberOfLines={3}
                  style={styles.descInput}
                />
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.statusField, pressed && styles.statusFieldPressed]}
              onPress={() => setSiteStatus((v) => (v === "ACTIVE" ? "INACTIVE" : "ACTIVE"))}
            >
              <Text style={styles.statusLabel}>Status</Text>
              <View style={styles.statusControl}>
                <Text style={styles.statusValue}>{siteStatus === "ACTIVE" ? "Active" : "Inactive"}</Text>
                <Text style={styles.statusChevron}>▾</Text>
              </View>
            </Pressable>
            <PrimaryButton
              title={editingSiteId ? "Save Site" : "Save Site"}
              onPress={onAddSite}
              disabled={busy || !name.trim()}
              loading={busy}
              style={styles.saveBtn}
            />
            {status ? <Text style={styles.meta}>{status}</Text> : null}
          </CardContainer>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  center: { flex: 1, justifyContent: "center" },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 96,
    gap: 12,
    backgroundColor: tokens.color.background,
  },
  form: {},
  headerWrap: { gap: tokens.space[1], marginBottom: tokens.space[1] },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  topIcon: { fontSize: 16, color: tokens.color.text },
  topTitle: { flex: 1, marginLeft: 8, fontSize: tokens.textSize.title, color: tokens.color.text, fontWeight: "600" },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EDE4D6", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, color: "#5F5342", fontWeight: "600" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: tokens.space[1] },
  searchBox: {
    flex: 1,
    height: 42,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  searchIcon: { color: tokens.color.muted, marginRight: 8 },
  searchText: { color: "#A0927B", fontSize: 12 },
  addInlineBtn: {
    height: 42,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.accent,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addInlineBtnText: { fontSize: 12, color: tokens.color.onAccent, fontWeight: "600" },
  formTitle: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: tokens.color.text, marginBottom: 8 },
  formHeaderRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  formHeaderFields: {
    flex: 1,
  },
  uploadTile: {
    width: 106,
    height: 118,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panelMuted,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 8,
    marginTop: 28,
  },
  uploadTileIcon: {
    fontSize: 28,
    color: "#B49662",
  },
  uploadTileText: {
    fontSize: 12,
    color: tokens.color.muted,
    fontWeight: "500",
  },
  descInput: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  statusField: {
    marginTop: 8,
    gap: 8,
  },
  statusFieldPressed: { opacity: 0.9 },
  statusLabel: {
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
    color: tokens.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statusControl: {
    height: 46,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panelMuted,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusValue: {
    color: tokens.color.text,
    fontSize: tokens.textSize.body,
    fontWeight: "500",
  },
  statusChevron: {
    color: tokens.color.muted,
    fontSize: 14,
  },
  saveBtn: {
    marginTop: 14,
  },
  meta: { fontSize: 13, color: tokens.color.muted },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.panelMuted,
  },
  editIcon: { fontSize: 14, color: tokens.color.text },
  empty: { textAlign: "center", color: tokens.color.muted, marginTop: 40 },
  siteCard: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.panel,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  siteIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F4EFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  siteIcon: { fontSize: 13, color: "#7F725A", fontWeight: "700" },
  siteMiddle: { flex: 1 },
  siteName: { fontSize: 14, fontWeight: "600", color: tokens.color.text },
  siteMeta: { marginTop: 2, fontSize: 10, color: tokens.color.muted },
  siteValue: { marginTop: 2, fontSize: 17, color: tokens.color.text, fontWeight: "700" },
  siteRight: { alignItems: "flex-end", gap: 4 },
  siteValueSmall: { fontSize: 17, color: tokens.color.text, fontWeight: "700" },
  statusPill: {
    borderRadius: 10,
    backgroundColor: "#EAF5EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: { fontSize: 10, color: "#2E7E59", fontWeight: "600" },
  statusPillTextInactive: { color: "#B55050" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 24,
    maxHeight: "85%",
  },
});
