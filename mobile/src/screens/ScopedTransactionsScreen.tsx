import { AppIcon } from "@/components/ui/AppIcon";
import { createApi } from "@/data/api/client";
import { formatRupee } from "@/core/formatRupee";
import { sumMoney, type RequirementMoneyRow } from "@/core/drilldown";
import { CardContainer } from "@/components/ui/CardContainer";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Tx = RequirementMoneyRow & {
  itemName: string;
  entryDate: string;
  uiType?: "RECEIVED" | "SENT" | "PENDING";
  createdBy?: { id: string };
  brand?: string | null;
  notes?: string | null;
};

type ListResp = { items: Tx[] };
type ScopedRoute = RouteProp<AuthedStackParamList, "ScopedTransactions">;

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

type TxRowProps = {
  item: Tx;
  canEdit: boolean;
  onPay: (id: string) => void;
  onEdit: (id: string) => void;
};

const ScopedTxRow = memo(function ScopedTxRow({ item, canEdit, onPay, onEdit }: TxRowProps) {
  const due = Number(item.remaining) || 0;
  const hasDue = due > 0.01;

  return (
    <Pressable
      style={({ pressed }) => [styles.txCard, pressed && styles.txCardPressed]}
      onPress={() => onPay(item.id)}
    >
      <View style={styles.txMiddle}>
        <Text style={styles.txTitle} numberOfLines={2}>
          {item.itemName}
        </Text>
        <Text style={styles.txDate}>{formatEntryDate(item.entryDate)}</Text>
        <Text style={styles.moneyLine}>
          Total {formatRupee(item.totalAmount)} · Paid {formatRupee(item.paidTotal)}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={styles.dueLabel}>Due</Text>
        <Text style={[styles.dueValue, hasDue ? styles.negative : styles.positive]}>
          {formatRupee(item.remaining)}
        </Text>
        {hasDue ? (
          <Pressable style={styles.payChip} onPress={() => onPay(item.id)} hitSlop={6}>
            <Text style={styles.payChipText}>Pay</Text>
          </Pressable>
        ) : (
          <View style={styles.doneChip}>
            <Text style={styles.doneChipText}>Paid</Text>
          </View>
        )}
        {canEdit ? (
          <Pressable style={styles.editBtn} onPress={() => onEdit(item.id)} hitSlop={8}>
            <AppIcon name="create-outline" size={16} color={tokens.color.muted} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
});

export function ScopedTransactionsScreen() {
  const { params } = useRoute<ScopedRoute>();
  const navigation = useNavigation<NavigationProp<AuthedStackParamList>>();
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const totals = useMemo(() => sumMoney(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter(
        (r) =>
          r.itemName.toLowerCase().includes(q) ||
          (r.brand ?? "").toLowerCase().includes(q) ||
          (r.notes ?? "").toLowerCase().includes(q),
      );
    }
    // Latest first
    return list.slice().sort((a, b) => {
      return new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime();
    });
  }, [rows, search]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErr(null);
      try {
        const api = createApi(() => token);
        const data = await api.get<ListResp>("/requirements", {
          page: "1",
          limit: "100",
          siteId: params.siteId,
          vendorId: params.vendorId,
          flow: "ALL",
        });
        setRows(data.items ?? []);
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Could not load transactions");
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [params.siteId, params.vendorId, token],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const renderItem = useCallback(
    ({ item }: { item: Tx }) => (
      <ScopedTxRow
        item={item}
        canEdit={Boolean(me?.id && item.createdBy?.id === me.id)}
        onPay={(id) => navigation.navigate("Payment", { id })}
        onEdit={(id) => navigation.navigate("EditEntry", { id })}
      />
    ),
    [me?.id, navigation],
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 88 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={[tokens.color.accent]}
            tintColor={tokens.color.accent}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.breadcrumb}>
              {params.siteName} › {params.vendorName}
            </Text>

            <View style={styles.kpiRow}>
              <CardContainer style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Paid</Text>
                <Text style={[styles.kpiValue, styles.positive]}>{formatRupee(totals.paid)}</Text>
              </CardContainer>
              <CardContainer style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Due</Text>
                <Text style={[styles.kpiValue, styles.negative]}>{formatRupee(totals.pending)}</Text>
              </CardContainer>
              <CardContainer style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Txns</Text>
                <Text style={styles.kpiValue}>{totals.transactions}</Text>
              </CardContainer>
            </View>

            <View style={styles.searchBox}>
              <AppIcon name="search-outline" size={15} color={tokens.color.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search transactions..."
                placeholderTextColor={tokens.color.placeholder}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </View>

            {err ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{err}</Text>
                <Pressable style={styles.retryBtn} onPress={() => void load()}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.listLoader}>
              <ActivityIndicator color={tokens.color.accent} />
            </View>
          ) : (
            <Text style={styles.empty}>
              {search.trim()
                ? "No matching transactions"
                : "No transactions yet. Tap + to add one."}
            </Text>
          )
        }
      />

      <View style={[styles.fabRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={({ pressed }) => [styles.fabSecondary, pressed && styles.pressed]}
          onPress={() =>
            navigation.navigate("AddEntry", {
              siteId: params.siteId,
              vendorId: params.vendorId,
              siteName: params.siteName,
              vendorName: params.vendorName,
            })
          }
        >
          <AppIcon name="add" size={18} color={tokens.color.sidebarText} />
          <Text style={styles.fabText}>Add transaction</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  list: { paddingHorizontal: tokens.space[2], paddingTop: tokens.space[2] },
  headerBlock: { gap: tokens.space[2], marginBottom: tokens.space[2] },
  breadcrumb: {
    fontSize: tokens.textSize.small,
    fontWeight: "600",
    color: tokens.color.muted,
  },
  kpiRow: { flexDirection: "row", gap: tokens.space[1] },
  kpiCard: { flex: 1, padding: tokens.space[2] },
  kpiLabel: {
    fontSize: tokens.textSize.caption,
    color: tokens.color.muted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  kpiValue: {
    marginTop: 6,
    fontSize: tokens.textSize.subtitle,
    fontWeight: "700",
    color: tokens.color.text,
    fontVariant: ["tabular-nums"],
  },
  positive: { color: tokens.color.positive },
  negative: { color: tokens.color.negative },
  searchBox: {
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
  searchInput: { flex: 1, color: tokens.color.text, fontSize: 13, paddingVertical: 0 },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: tokens.color.panel,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    ...tokens.shadow.card,
  },
  txCardPressed: { backgroundColor: tokens.color.blockHover },
  txMiddle: { flex: 1, minWidth: 0 },
  txTitle: { fontSize: tokens.textSize.body, fontWeight: "600", color: tokens.color.text },
  txDate: { marginTop: 2, fontSize: tokens.textSize.caption, color: tokens.color.muted },
  moneyLine: { marginTop: 4, fontSize: 11, color: tokens.color.muted },
  txRight: { alignItems: "flex-end", gap: 4 },
  dueLabel: {
    fontSize: 10,
    color: tokens.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dueValue: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  payChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.sidebar,
  },
  payChipText: { color: tokens.color.sidebarText, fontSize: 11, fontWeight: "700" },
  doneChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.positiveMuted ?? tokens.color.panelMuted,
  },
  doneChipText: { color: tokens.color.positive, fontSize: 11, fontWeight: "700" },
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
  divider: { height: tokens.space[1] },
  listLoader: { minHeight: 160, alignItems: "center", justifyContent: "center" },
  empty: {
    textAlign: "center",
    color: tokens.color.muted,
    marginTop: tokens.space[4],
    fontSize: tokens.textSize.small,
  },
  errorBanner: {
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.negativeMuted,
    backgroundColor: tokens.color.negativeMuted,
    padding: tokens.space[2],
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
  retryText: { color: tokens.color.text, fontSize: tokens.textSize.caption, fontWeight: "600" },
  fabRow: {
    position: "absolute",
    left: tokens.space[2],
    right: tokens.space[2],
    bottom: 0,
  },
  fabSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sidebar,
    ...tokens.shadow.fab,
  },
  fabText: { color: tokens.color.sidebarText, fontWeight: "700", fontSize: 14 },
  pressed: { opacity: 0.9 },
});
