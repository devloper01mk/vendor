import { AppIcon } from "@/components/ui/AppIcon";
import { tokens } from "@/theme/tokens";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SearchableOption = { id: string; name: string };

type SearchableSelectProps = {
  label: string;
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  /** Optional + action on the right of the field */
  onAddPress?: () => void;
  searchPlaceholder?: string;
};

export const SearchableSelect = React.memo(function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  error,
  onAddPress,
  searchPlaceholder = "Search…",
}: SearchableSelectProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  function openSheet() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  }

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [
            styles.trigger,
            error ? styles.triggerError : null,
            disabled && styles.triggerDisabled,
            pressed && !disabled && styles.triggerPressed,
          ]}
          onPress={openSheet}
          disabled={disabled}
        >
          <Text
            style={[styles.triggerText, !selected && styles.triggerPlaceholder]}
            numberOfLines={1}
          >
            {selected?.name ?? placeholder}
          </Text>
          <AppIcon name="chevron-down" size={16} color={tokens.color.muted} />
        </Pressable>
        {onAddPress && !disabled ? (
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            onPress={onAddPress}
            hitSlop={8}
          >
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <AppIcon name="close" size={20} color={tokens.color.muted} />
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <AppIcon name="search-outline" size={16} color={tokens.color.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor={tokens.color.placeholder}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
                clearButtonMode="while-editing"
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {query.trim() ? "No matches" : "No options yet"}
                </Text>
              }
              renderItem={({ item }) => {
                const selectedRow = item.id === value;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.option,
                      selectedRow && styles.optionOn,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() => pick(item.id)}
                  >
                    <Text
                      style={[styles.optionText, selectedRow && styles.optionTextOn]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    {selectedRow ? (
                      <AppIcon name="checkmark" size={18} color={tokens.color.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: tokens.textSize.caption,
    fontWeight: "600",
    color: tokens.color.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trigger: {
    flex: 1,
    minHeight: 48,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  triggerError: { borderColor: tokens.color.negative },
  triggerDisabled: { opacity: 0.65, backgroundColor: tokens.color.panelMuted },
  triggerPressed: { backgroundColor: tokens.color.blockHover },
  triggerText: {
    flex: 1,
    fontSize: tokens.textSize.body,
    color: tokens.color.text,
    fontWeight: "500",
  },
  triggerPlaceholder: { color: tokens.color.placeholder, fontWeight: "400" },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.sidebar,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnPressed: { opacity: 0.88 },
  addBtnText: {
    color: tokens.color.sidebarText,
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 24,
  },
  error: {
    fontSize: tokens.textSize.caption,
    color: tokens.color.negative,
    fontWeight: "600",
  },
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: tokens.color.overlay },
  sheet: {
    maxHeight: "75%",
    backgroundColor: tokens.color.background,
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    paddingTop: tokens.space[2],
    paddingHorizontal: tokens.space[2],
    gap: tokens.space[1],
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: tokens.textSize.subtitle,
    fontWeight: "700",
    color: tokens.color.ink,
  },
  searchBox: {
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: tokens.color.text,
    paddingVertical: 0,
  },
  list: { flexGrow: 0 },
  listContent: {
    paddingVertical: tokens.space[1],
    paddingBottom: tokens.space[2],
  },
  sep: { height: 6 },
  option: {
    minHeight: 48,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  optionOn: {
    borderColor: tokens.color.accent,
    backgroundColor: tokens.color.accentMuted,
  },
  optionPressed: { backgroundColor: tokens.color.blockHover },
  optionText: {
    flex: 1,
    fontSize: tokens.textSize.body,
    color: tokens.color.text,
    fontWeight: "500",
  },
  optionTextOn: { fontWeight: "700", color: tokens.color.ink },
  empty: {
    textAlign: "center",
    color: tokens.color.muted,
    paddingVertical: tokens.space[3],
    fontSize: tokens.textSize.small,
  },
});
