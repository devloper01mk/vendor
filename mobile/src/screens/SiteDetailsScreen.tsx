import { createApi } from "@/data/api/client";
import { formatRupee } from "@/core/formatRupee";
import {
  aggregateByVendor,
  sumMoney,
  type PartnerAmount,
  type RequirementMoneyRow,
} from "@/core/drilldown";
import { CardContainer } from "@/components/ui/CardContainer";
import { useAuthStore } from "@/features/auth/store";
import type { AuthedStackParamList } from "@/navigation/types";
import { tokens } from "@/theme/tokens";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Site = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
};

type ListResp = { items: RequirementMoneyRow[] };
type SiteRoute = RouteProp<AuthedStackParamList, "SiteDetails">;
type Nav = NativeStackNavigationProp<AuthedStackParamList>;

export function SiteDetailsScreen() {
  const { params } = useRoute<SiteRoute>();
  const navigation = useNavigation<Nav>();
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const skippedRef = useRef(false);

  const [site, setSite] = useState<Site | null>(null);
  const [vendors, setVendors] = useState<PartnerAmount[]>([]);
  const [totals, setTotals] = useState({ paid: 0, pending: 0, total: 0, transactions: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openScoped = useCallback(
    (vendor: PartnerAmount, siteName: string) => {
      navigation.navigate("ScopedTransactions", {
        siteId: params.id,
        vendorId: vendor.id,
        siteName,
        vendorName: vendor.name,
      });
    },
    [navigation, params.id],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErr(null);
      try {
        const api = createApi(() => token);
        const [allSites, reqList] = await Promise.all([
          api.get<Site[]>("/sites"),
          api.get<ListResp>("/requirements", {
            page: "1",
            limit: "100",
            siteId: params.id,
            flow: "ALL",
          }),
        ]);
        const selected = allSites.find((s) => s.id === params.id) ?? null;
        if (!selected) throw new Error("Site not found");

        const items = reqList.items ?? [];
        const partnerVendors = aggregateByVendor(items);
        const money = sumMoney(items);

        setSite(selected);
        setVendors(partnerVendors);
        setTotals(money);

        // Smart skip: exactly one vendor → go straight to scoped transactions
        if (!skippedRef.current && partnerVendors.length === 1) {
          skippedRef.current = true;
          navigation.replace("ScopedTransactions", {
            siteId: selected.id,
            vendorId: partnerVendors[0].id,
            siteName: selected.name,
            vendorName: partnerVendors[0].name,
          });
        }
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Could not load site");
        setSite(null);
        setVendors([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigation, params.id, token],
  );

  useFocusEffect(
    useCallback(() => {
      skippedRef.current = false;
      void load();
    }, [load]),
  );

  if (loading && !site) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.color.accent} />
      </View>
    );
  }

  if (!site) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>{err || "Site details unavailable"}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const subtitle = [site.code?.trim(), site.address?.trim()].filter(Boolean).join(" · ");

  return (
    <View style={styles.screen}>
      <FlatList
        data={vendors}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + tokens.space[4] },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={[tokens.color.accent]}
            tintColor={tokens.color.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <CardContainer style={styles.block}>
              <Text style={styles.title}>{site.name}</Text>
              {subtitle ? <Text style={styles.meta}>{subtitle}</Text> : null}
            </CardContainer>

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
                <Text style={styles.kpiLabel}>Total</Text>
                <Text style={styles.kpiValue}>{formatRupee(totals.total)}</Text>
              </CardContainer>
            </View>

            {err ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{err}</Text>
                <Pressable style={styles.retryBtn} onPress={() => void load()}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>
              {vendors.length > 1 ? "Vendors on this site" : vendors.length === 1 ? "Vendor" : "Vendors"}
            </Text>
            <Text style={styles.sectionHint}>
              {vendors.length
                ? "Tap a vendor to see transactions and add payment"
                : "No transactions on this site yet"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => openScoped(item, site.name)}
          >
            <View style={styles.rowMiddle}>
              <Text style={styles.rowName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.rowSub}>
                {item.transactions} txn{item.transactions === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowMeta}>Paid</Text>
              <Text style={styles.rowPaid}>{formatRupee(item.paid)}</Text>
              <Text style={styles.rowMeta}>Due</Text>
              <Text style={styles.rowDue}>{formatRupee(item.pending)}</Text>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.listLoader}>
              <ActivityIndicator color={tokens.color.accent} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.color.background,
    gap: tokens.space[2],
    padding: tokens.space[3],
  },
  list: {
    paddingHorizontal: tokens.space[2],
    paddingTop: tokens.space[2],
    gap: tokens.space[1],
  },
  headerBlock: { gap: tokens.space[2], marginBottom: tokens.space[1] },
  block: { gap: 4 },
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
  sectionTitle: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "600",
    color: tokens.color.text,
  },
  sectionHint: { fontSize: tokens.textSize.caption, color: tokens.color.muted, marginTop: -6 },
  row: {
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
  rowPressed: { backgroundColor: tokens.color.blockHover },
  rowMiddle: { flex: 1, minWidth: 0 },
  rowName: { fontSize: tokens.textSize.body, fontWeight: "600", color: tokens.color.text },
  rowSub: { marginTop: 2, fontSize: tokens.textSize.caption, color: tokens.color.muted },
  rowRight: { alignItems: "flex-end", gap: 2 },
  rowMeta: {
    fontSize: 10,
    color: tokens.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  rowPaid: { fontSize: 15, fontWeight: "700", color: tokens.color.positive, fontVariant: ["tabular-nums"] },
  rowDue: { fontSize: 15, fontWeight: "700", color: tokens.color.negative, fontVariant: ["tabular-nums"] },
  divider: { height: tokens.space[1] },
  listLoader: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: tokens.textSize.small, color: tokens.color.muted, textAlign: "center" },
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
});
