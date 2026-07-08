import React from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalEditorStore } from '@/stores/editorStore';
import { useProjectStore, selectActiveProject } from '@/stores/projectStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, S, F, R, shadows } from '@/constants/theme';
import { type Section, type Chapter } from '@/services/api';

export function GlobalDropdown() {
  const visible = useGlobalEditorStore(s => s.isDropdownOpen);
  const setDropdownOpen = useGlobalEditorStore(s => s.setDropdownOpen);
  
  const project = useProjectStore(selectActiveProject);
  const activeChapterId = useProjectStore(s => s.activeChapterId);
  const insets = useSafeAreaInsets();

  if (!project || !visible) return null;

  const AUTO_SECTION_IDS = new Set(['title_page', 'toc']);
  const list = [
    ...project.frontMatter.filter(s => !AUTO_SECTION_IDS.has(s.id)),
    ...project.chapters
  ];

  const switchToChapter = (id: string) => {
    const activeChapterId = useProjectStore.getState().activeChapterId;
    const projectState = useProjectStore.getState();
    const activeProject = projectState.projects.find(p => p.id === projectState.activeProjectId);
    
    const activeSection = activeProject?.chapters.find(c => c.id === activeChapterId) ||
      activeProject?.frontMatter.find(s => s.id === activeChapterId);
      
    const editor = useGlobalEditorStore.getState().bridge;
    if (activeSection && editor) {
      editor.getJSON().then((json: any) => {
        useProjectStore.getState().updateSectionContent(activeSection.id, json);
      });
    }
    useProjectStore.getState().setActiveChapter(id);
  };

  const topOffset = insets.top + 56 + S.xs;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={() => setDropdownOpen(false)}
        activeOpacity={1}
      />
      <View style={[styles.dropdown, { top: topOffset }]} pointerEvents="auto">
        <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
          {list.map(s => {
            const id = (s as any).id;
            const lbl = (s as Chapter).title ?? (s as Section).label;
            const isActive = activeChapterId === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                onPress={() => {
                  switchToChapter(id);
                  setDropdownOpen(false);
                }}
              >
                <Text style={[styles.dropdownText, isActive && { color: C.accent, fontWeight: '700' }]}>
                  {lbl}
                </Text>
                {isActive && <Ionicons name="checkmark" size={14} color={C.accent} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    position: 'absolute',
    left: S.xl,
    right: S.xl,
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    zIndex: 999,
    ...shadows.strong,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingVertical: S.md,
  },
  dropdownItemActive: {
    backgroundColor: C.accentGlow,
  },
  dropdownText: {
    fontSize: F.sm,
    color: C.text,
  },
});
