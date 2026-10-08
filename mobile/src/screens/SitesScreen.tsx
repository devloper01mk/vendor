import { AppIcon } from "@/components/ui/AppIcon";
import { createApi } from "@/data/api/client";
import { CardContainer } from "@/components/ui/CardContainer";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenChrome } from "@/components/ui/ScreenChrome";
import { useAuthStore } from "@/features/auth/store";
import { tokens } from "@/theme/tokens";
import type { AuthedStackParamList } from "@/navigation/types";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

type Site = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  createdAt?: string;
  metrics?: {
    totalSpent: string;
    transactions: number;
  };
};

type SiteRowProps = {
  item: Site;
  onOpen: (site: Site) => void;
  onEdit: (site: Site) => void;
};

const SiteRow = memo(function SiteRow({ item, onOpen, onEdit }: SiteRowProps) {
  const subtitle = [item.code?.trim(), item.address?.trim()].filter(Boolean).join(" · ");

  return (
    <Pressable
      style={({ pressed }) => [styles.siteCard, pressed && styles.siteCardPressed]}
      onPress={() => onOpen(item)}
    >
      <View style={styles.siteMiddle}>
        <Text style={styles.siteName} numberOfLines={2}>
          {item.name}
        </Text>
        {subtitle ? (
          <Text style={styles.siteSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <Text style={styles.siteMeta}>Total spent</Text>
        <Text style={styles.siteValue}>₹ {item.metrics?.totalSpent ?? "0"}</Text>
      </View>
      <View style={styles.siteRight}>
        <Text style={styles.siteMeta}>Transactions</Text>
        <Text style={styles.siteValueSmall}>{item.metrics?.transactions ?? 0}</Text>
        <Pressable style={styles.editBtn} onPress={() => onEdit(item)} hitSlop={8}>
          <AppIcon name="create-outline" size={16} color={tokens.color.muted} />
        </Pressable>
      </View>
    </Pressable>
  );
});

export function SitesScreen() {
  const token = useAuthStore((s) => s.token);
  const navigation = useNavigation<NavigationProp<AuthedStackParamList>>();
  const [rows, setRows] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [listError, setListError] = useState<string | null>(null);

  const listContentStyle = useMemo(
    () => [styles.list, styles.listContent],
    [],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code ?? "").toLowerCase().includes(q) ||
          (s.address ?? "").toLowerCase().includes(q),
      );
    }
    return list.slice().sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [rows, search]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!rows.length) setLoading(true);
    setListError(null);
    try {
      const api = createApi(() => token);
      const data = await api.get<Site[]>("/sites");
      setRows(data);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not load sites");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, rows.length]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openAddSheet = useCallback(() => {
    setEditingSiteId(null);
    setName("");
    setCode("");
    setAddress("");
    setStatus(null);
    setSheetOpen(true);
  }, []);

  const openEditSheet = useCallback((s: Site) => {
    setEditingSiteId(s.id);
    setName(s.name ?? "");
    setCode(s.code ?? "");
    setAddress(s.address ?? "");
    setStatus(null);
    setSheetOpen(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Site }) => (
      <SiteRow
        item={item}
        onOpen={(site) => navigation.navigate("SiteDetails", { id: site.id })}
        onEdit={openEditSheet}
      />
    ),
    [navigation, openEditSheet],
  );

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
      await loadData(true);
      setStatus(editingSiteId ? "Site updated" : "Site added");
      setSheetOpen(false);
    } catch {
      setStatus(editingSiteId ? "Failed to update site" : "Failed to add site");
    } finally {
      setBusy(false);
    }
  }

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.listLoader}>
          <ActivityIndicator color={tokens.color.accent} />
        </View>
      );
    }
    if (listError) {
      return <Text style={styles.empty}>Unable to load sites. Pull to refresh.</Text>;
    }
    if (search.trim()) {
      return <Text style={styles.empty}>No sites match your search.</Text>;
    }
    return <Text style={styles.empty}>No sites yet. Tap + Add to create one.</Text>;
  }, [loading, listError, search]);

  return (
    <View style={styles.screen}>
      <ScreenChrome title="Sites" onSettingsPress={() => navigation.navigate("Settings")}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <AppIcon name="search-outline" size={15} color={tokens.color.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search sites..."
              placeholderTextColor={tokens.color.placeholder}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>
          <Pressable style={styles.addInlineBtn} onPress={openAddSheet}>
            <Text style={styles.addInlineBtnText}>+ Add</Text>
          </Pressable>
        </View>
        {listError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{listError}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void loadData(true)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </ScreenChrome>

      <FlatList
        style={styles.siteList}
        contentContainerStyle={listContentStyle}
        data={filteredRows}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || (loading && rows.length > 0)}
            onRefresh={() => loadData(true)}
            colors={[tokens.color.accent]}
            tintColor={tokens.color.accent}
          />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        ItemSeparatorComponent={() => <View style={styles.cardGap} />}
        ListEmptyComponent={listEmpty}
      />

      <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
          <CardContainer style={styles.sheet}>
            <Text style={styles.formTitle}>{editingSiteId ? "Edit site" : "New site"}</Text>
            <View style={styles.formHeaderRow}>
              <Pressable style={styles.uploadTile}>
                <AppIcon name="image-outline" size={22} color={tokens.color.muted} />
                <Text style={styles.uploadTileText}>Upload icon</Text>
              </Pressable>
              <View style={styles.formHeaderFields}>
                <InputField label="Site name" placeholder="Enter site name" value={name} onChangeText={setName} />
                <InputField label="Code" placeholder="Optional site code" value={code} onChangeText={setCode} />
                <InputField
                  label="Address"
                  placeholder="Optional address"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  numberOfLines={3}
                  style={styles.descInput}
                />
              </View>
            </View>
            <View style={styles.saveBtn}>
              <PrimaryButton
                title={editingSiteId ? "Save site" : "Add site"}
                onPress={onAddSite}
                disabled={busy || !name.trim()}
                loading={busy}
              />
            </View>
            {status ? <Text style={styles.meta}>{status}</Text> : null}
          </CardContainer>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  siteList: { flex: 1 },
  listLoader: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.space[5],
  },
  list: {
    paddingHorizontal: tokens.space[2],
    paddingBottom: 96,
    backgroundColor: tokens.color.background,
  },
  listContent: { flexGrow: 1 },
  cardGap: { height: tokens.space[1] },
  searchRow: { flexDirection: "row", alignItems: "center", gap: tokens.space[1] },
  searchBox: {
    flex: 1,
    height: 42,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: tokens.color.text, fontSize: 12, paddingVertical: 0 },
  errorBanner: {
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.negativeMuted,
    backgroundColor: tokens.color.negativeMuted,
    padding: tokens.space[2],
    marginTop: tokens.space[1],
    gap: tokens.space[1],
  },
  errorText: { color: tokens.color.negative, fontSize: tokens.textSize.caption, fontWeight: "600" },
  retryBtn: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 8,
    backgroundColor: tokens.color.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  retryBtnText: { color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
  addInlineBtn: {
    height: 42,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sidebar,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addInlineBtnText: { fontSize: 12, color: tokens.color.sidebarText, fontWeight: "600" },
  formTitle: {
    fontSize: tokens.textSize.subtitle,
    lineHeight: 24,
    fontWeight: "700",
    color: tokens.color.ink,
    marginBottom: 8,
  },
  formHeaderRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  formHeaderFields: {
    flex: 1,
  },
  uploadTile: {
    width: 92,
    minHeight: 118,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panelMuted,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 8,
    marginTop: 28,
  },
  uploadTileText: {
    fontSize: 11,
    color: tokens.color.muted,
    fontWeight: "500",
    textAlign: "center",
  },
  descInput: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  saveBtn: {
    marginTop: 14,
  },
  meta: { fontSize: tokens.textSize.small, color: tokens.color.muted },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.blockHover,
  },
  empty: {
    textAlign: "center",
    color: tokens.color.muted,
    marginTop: tokens.space[4],
    fontSize: tokens.textSize.small,
    lineHeight: 20,
  },
  siteCard: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: tokens.color.panel,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    ...tokens.shadow.card,
  },
  siteCardPressed: {
    backgroundColor: tokens.color.blockHover,
  },
  siteMiddle: { flex: 1, minWidth: 0 },
  siteName: { fontSize: tokens.textSize.body, fontWeight: "600", color: tokens.color.text },
  siteSub: { marginTop: 2, fontSize: tokens.textSize.caption, color: tokens.color.muted },
  siteMeta: { marginTop: 6, fontSize: 10, color: tokens.color.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  siteValue: { marginTop: 2, fontSize: 17, color: tokens.color.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  siteRight: { alignItems: "flex-end", gap: 4 },
  siteValueSmall: { fontSize: 17, color: tokens.color.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: tokens.color.overlay },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: tokens.space[3],
    maxHeight: "85%",
  },
});
