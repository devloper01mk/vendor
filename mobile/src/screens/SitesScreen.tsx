import { createApi } from "@/data/api/client";
import { CardContainer } from "@/components/ui/CardContainer";
import { InputField } from "@/components/ui/InputField";
import { ListItem } from "@/components/ui/ListItem";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Site = { id: string; name: string; code: string | null; address: string | null };

export function SitesScreen() {
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
    setStatus(null);
    setSheetOpen(true);
  }

  function openEditSheet(s: Site) {
    setEditingSiteId(s.id);
    setName(s.name ?? "");
    setCode(s.code ?? "");
    setAddress(s.address ?? "");
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
        renderItem={({ item }) => (
          <ListItem
            title={item.name}
            subtitle={`${item.address ?? "No address"}${item.code ? ` • ${item.code}` : ""}`}
            rightSlot={
              <Pressable style={styles.editBtn} onPress={() => openEditSheet(item)} hitSlop={8}>
                <Text style={styles.editIcon}>✎</Text>
              </Pressable>
            }
            onPress={() => {}}
            showChevron={false}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No sites</Text>}
      />

      <Pressable style={styles.fab} onPress={openAddSheet} hitSlop={8}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
          <CardContainer style={styles.sheet}>
            <Text style={styles.formTitle}>{editingSiteId ? "Edit site" : "Add site"}</Text>
            <InputField label="Site name" placeholder="Enter site name" value={name} onChangeText={setName} />
            <InputField label="Code" placeholder="Enter site code (optional)" value={code} onChangeText={setCode} />
            <InputField label="Address" placeholder="Enter address" value={address} onChangeText={setAddress} />
            <PrimaryButton
              title={editingSiteId ? "Update site" : "Add site"}
              onPress={onAddSite}
              disabled={busy || !name.trim()}
              loading={busy}
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
  formTitle: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: tokens.color.text, marginBottom: 8 },
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
  fab: {
    position: "absolute",
    right: tokens.space[2],
    bottom: tokens.space[3],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.color.accent,
    alignItems: "center",
    justifyContent: "center",
    ...tokens.shadow.fab,
  },
  fabText: { color: tokens.color.onAccent, fontSize: 30, lineHeight: 32, fontWeight: "600" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 24,
    maxHeight: "85%",
  },
});
