import { createApi } from "@/data/api/client";
import { formatRupee } from "@/core/formatRupee";
import {
  aggregateBySite,
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
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Vendor = {
  id: string;
  name: string;
  phone?: string | null;
  alternatePhone?: string | null;
  gstNumber?: string | null;
  totals: { pending: string; paid: string };
};

type ListResp = { items: RequirementMoneyRow[] };
type VendorRoute = RouteProp<AuthedStackParamList, "VendorDetails">;
type Nav = NativeStackNavigationProp<AuthedStackParamList>;

export function VendorDetailsScreen() {
  const { params } = useRoute<VendorRoute>();
  const navigation = useNavigation<Nav>();
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const skippedRef = useRef(false);

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [sites, setSites] = useState<PartnerAmount[]>([]);
  const [totals, setTotals] = useState({ paid: 0, pending: 0, total: 0, transactions: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openScoped = useCallback(
    (site: PartnerAmount, vendorName: string) => {
      navigation.navigate("ScopedTransactions", {
        siteId: site.id,
        vendorId: params.id,
        siteName: site.name,
        vendorName,
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
        const [allVendors, reqList] = await Promise.all([
          api.get<Vendor[]>("/vendors"),
          api.get<ListResp>("/requirements", {
            page: "1",
            limit: "100",
            vendorId: params.id,
            flow: "ALL",
          }),
        ]);
        const selected = allVendors.find((v) => v.id === params.id) ?? null;
        if (!selected) throw new Error("Vendor not found");

        const items = reqList.items ?? [];
        const partnerSites = aggregateBySite(items);
        const money = sumMoney(items);

        setVendor(selected);
        setSites(partnerSites);
        setTotals(money);

        if (!skippedRef.current && partnerSites.length === 1) {
          skippedRef.current = true;
          navigation.replace("ScopedTransactions", {
            siteId: partnerSites[0].id,
            vendorId: selected.id,
            siteName: partnerSites[0].name,
            vendorName: selected.name,
          });
        }
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Could not load vendor");
        setVendor(null);
        setSites([]);
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

  if (loading && !vendor) {
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
        <Pressable style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const phone = vendor.phone?.trim();

  return (
    <View style={styles.screen}>
      <FlatList
        data={sites}
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
              <Text style={styles.title}>{vendor.name}</Text>
              <Text style={styles.meta}>GST: {vendor.gstNumber?.trim() || "—"}</Text>
              <Text style={styles.meta}>Phone: {phone || "—"}</Text>
              {phone ? (
                <Pressable
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${phone}`)}
                >
                  <Text style={styles.callBtnText}>Call vendor</Text>
                </Pressable>
              ) : null}
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
              {sites.length > 1 ? "Sites connected" : sites.length === 1 ? "Site" : "Sites"}
            </Text>
            <Text style={styles.sectionHint}>
              {sites.length
                ? "Tap a site to see transactions and add payment"
                : "No transactions for this vendor yet"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => openScoped(item, vendor.name)}
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
  callBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sidebar,
  },
  callBtnText: { color: tokens.color.sidebarText, fontSize: 12, fontWeight: "600" },
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
