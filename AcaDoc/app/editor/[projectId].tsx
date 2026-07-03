import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Brand, Space, FontSize, Radius } from '@/constants/theme';
import type { Section, Chapter, TiptapDoc } from '@/services/api';

// ── Tiptap ↔ plain-text helpers ───────────────────────────────────────────────

function textToTiptap(text: string): TiptapDoc {
  const lines = text.split('\n');
  return {
    type: 'doc',
    content: lines.map(line => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

function tiptapToText(doc: TiptapDoc | null): string {
  if (!doc?.content) return '';
  return doc.content
    .map(node => (node.content ?? []).map(n => n.text ?? '').join(''))
    .join('\n');
}

// ── Sidebar item ──────────────────────────────────────────────────────────────

function SidebarItem({
  label, isActive, onPress, onDelete, hasContent,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  onDelete?: () => void;
  hasContent: boolean;
}) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.sidebarItem,
        isActive && { backgroundColor: C.accentLight, borderRightColor: Brand.accent, borderRightWidth: 3 },
      ]}
    >
      <View style={styles.sidebarRow}>
        <View style={[styles.dot, { backgroundColor: hasContent ? Brand.success : C.borderStrong }]} />
        <Text style={[styles.sidebarLabel, { color: isActive ? C.accent : C.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} hitSlop={8}>
          <Ionicons name="close-circle-outline" size={16} color={C.textMuted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ── Add chapter modal ─────────────────────────────────────────────────────────

function AddChapterModal({
  visible, onClose, onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');

  function handleAdd() {
    if (!title.trim()) { setErr('Chapter title is required'); return; }
    onAdd(title.trim());
    setTitle('');
    setErr('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.modalTitle, { color: C.text }]}>Add chapter</Text>
          <Input
            label="Chapter title"
            placeholder="e.g. Literature Review"
            value={title}
            onChangeText={v => { setTitle(v); setErr(''); }}
            error={err}
            autoFocus
            autoCapitalize="words"
          />
          <View style={styles.modalActions}>
            <Button label="Cancel" onPress={onClose} variant="ghost" fullWidth={false} />
            <Button label="Add" onPress={handleAdd} fullWidth={false} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Rename chapter modal ──────────────────────────────────────────────────────

function RenameModal({
  visible, current, onClose, onRename,
}: {
  visible: boolean;
  current: string;
  onClose: () => void;
  onRename: (title: string) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const [title, setTitle] = useState(current);
  const [err, setErr] = useState('');

  useEffect(() => { if (visible) setTitle(current); }, [visible, current]);

  function handleSave() {
    if (!title.trim()) { setErr('Title is required'); return; }
    onRename(title.trim());
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.modalTitle, { color: C.text }]}>Rename chapter</Text>
          <Input
            label="Chapter title"
            value={title}
            onChangeText={v => { setTitle(v); setErr(''); }}
            error={err}
            autoFocus
            autoCapitalize="words"
          />
          <View style={styles.modalActions}>
            <Button label="Cancel" onPress={onClose} variant="ghost" fullWidth={false} />
            <Button label="Rename" onPress={handleSave} fullWidth={false} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Metadata modal ────────────────────────────────────────────────────────────

function MetadataModal({
  visible, metadata, onClose, onSave,
}: {
  visible: boolean;
  metadata: Record<string, any>;
  onClose: () => void;
  onSave: (fields: Record<string, string>) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [fields, setFields] = useState({
    title: '', authors: '', institution: '', department: '', guide: '', year: '',
  });

  useEffect(() => {
    if (visible) {
      setFields({
        title:       metadata?.title       ?? '',
        authors:     metadata?.authors     ?? '',
        institution: metadata?.institution ?? '',
        department:  metadata?.department  ?? '',
        guide:       metadata?.guide       ?? '',
        year:        metadata?.year        ?? '',
      });
    }
  }, [visible, metadata]);

  function setF(key: string, val: string) {
    setFields(f => ({ ...f, [key]: val }));
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheetHeader, { paddingTop: insets.top + Space.sm, backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.sheetTitle, { color: C.text }]}>Document metadata</Text>
          <TouchableOpacity onPress={() => onSave(fields)}>
            <Text style={[styles.sheetSave, { color: Brand.accent }]}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.metaForm}>
            <Input label="Title"            value={fields.title}       onChangeText={v => setF('title', v)}       placeholder="Document title"          autoCapitalize="words" />
            <Input label="Author(s)"        value={fields.authors}     onChangeText={v => setF('authors', v)}     placeholder="Name, Name"               autoCapitalize="words" />
            <Input label="Institution"      value={fields.institution} onChangeText={v => setF('institution', v)} placeholder="College / University"      autoCapitalize="words" />
            <Input label="Department"       value={fields.department}  onChangeText={v => setF('department', v)}  placeholder="e.g. Computer Engineering" autoCapitalize="words" />
            <Input label="Guide / Supervisor" value={fields.guide}     onChangeText={v => setF('guide', v)}       placeholder="Prof. Name"               autoCapitalize="words" />
            <Input label="Year"             value={fields.year}        onChangeText={v => setF('year', v)}        placeholder="2025"                     keyboardType="numeric" maxLength={4} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main editor screen ────────────────────────────────────────────────────────

export default function EditorScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const scheme  = useColorScheme() ?? 'light';
  const C       = Colors[scheme];

  const {
    getActiveProject, getActiveSection,
    activeChapterId, setActiveChapter,
    updateSectionContent, updateMetadata,
    addChapter, deleteChapter, renameChapter,
    openProject,
  } = useProjectStore();

  // Ensure correct project is active on deep-link / direct navigation
  useEffect(() => {
    if (projectId) openProject(projectId as string);
  }, [projectId]);

  const project       = getActiveProject();
  const activeSection = getActiveSection();

  const [sidebarOpen, setSidebarOpen]       = useState(true);
  const [addChapterModal, setAddChapterModal] = useState(false);
  const [renameModal, setRenameModal]       = useState(false);
  const [renameTarget, setRenameTarget]     = useState<Chapter | null>(null);
  const [metaOpen, setMetaOpen]             = useState(false);
  const [draftText, setDraftText]           = useState('');

  // Load text when active section changes
  useEffect(() => {
    setDraftText(tiptapToText(activeSection?.content ?? null));
  }, [activeChapterId]);

  // Flush draft to store when user leaves the text area
  const handleTextBlur = useCallback(() => {
    if (!activeSection) return;
    updateSectionContent(activeSection.id, textToTiptap(draftText));
  }, [activeSection, draftText]);

  function handleDeleteChapter(c: Chapter) {
    Alert.alert('Delete chapter', `Delete "${c.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteChapter(c.id) },
    ]);
  }

  function handleRenameOpen(c: Chapter) {
    setRenameTarget(c);
    setRenameModal(true);
  }

  function handleCompile() {
    // Flush current text before navigating
    if (activeSection) updateSectionContent(activeSection.id, textToTiptap(draftText));
    router.push({ pathname: '/compile/[projectId]', params: { projectId: project!.id } });
  }

  if (!project) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: C.background }]}>
        <Text style={{ color: C.textMuted }}>Project not found</Text>
      </View>
    );
  }

  const isChapter = (s: Section | Chapter): s is Chapter =>
    project.chapters.some(c => c.id === s.id);

  return (
    <View style={[styles.screen, { backgroundColor: C.background }]}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + Space.sm, backgroundColor: C.surface, borderBottomColor: C.border }]}>

        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.titleWrap} onPress={() => setMetaOpen(true)}>
          <Text style={[styles.topBarTitle, { color: C.text }]} numberOfLines={1}>
            {project.metadata?.title || 'Untitled'}
          </Text>
          <Ionicons name="pencil-outline" size={13} color={C.textMuted} />
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            onPress={() => setSidebarOpen(v => !v)}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Ionicons name="list-outline" size={22} color={C.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCompile}
            style={[styles.compileBtn, { backgroundColor: Brand.accent }]}
          >
            <Ionicons name="play" size={13} color="#fff" />
            <Text style={styles.compileBtnText}>Compile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Body: sidebar + editor ── */}
      <View style={styles.body}>

        {/* Sidebar */}
        {sidebarOpen && (
          <View style={[styles.sidebar, { backgroundColor: C.surfaceAlt, borderRightColor: C.border }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sidebarSection, { color: C.textMuted }]}>FRONT MATTER</Text>
              {project.frontMatter
                .filter(s => s.id !== 'title_page' && s.id !== 'toc')
                .map(s => (
                  <SidebarItem
                    key={s.id}
                    label={s.label}
                    isActive={activeChapterId === s.id}
                    hasContent={!!s.content}
                    onPress={() => setActiveChapter(s.id)}
                  />
                ))}

              <Text style={[styles.sidebarSection, { color: C.textMuted, marginTop: Space.md }]}>CHAPTERS</Text>
              {project.chapters.map(c => (
                <SidebarItem
                  key={c.id}
                  label={c.title}
                  isActive={activeChapterId === c.id}
                  hasContent={!!c.content}
                  onPress={() => setActiveChapter(c.id)}
                  onDelete={c.required ? undefined : () => handleDeleteChapter(c)}
                />
              ))}

              <TouchableOpacity
                onPress={() => setAddChapterModal(true)}
                style={[styles.addBtn, { borderColor: C.border }]}
              >
                <Ionicons name="add" size={16} color={C.accent} />
                <Text style={[styles.addBtnText, { color: C.accent }]}>Add chapter</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Editor */}
        <KeyboardAvoidingView
          style={styles.editorWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 60}
        >
          {activeSection ? (
            <ScrollView
              style={styles.editorScroll}
              contentContainerStyle={styles.editorContent}
              keyboardDismissMode="interactive"
            >
              {/* Section heading */}
              <View style={[styles.sectionHead, { borderBottomColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.text }]}>
                  {isChapter(activeSection) ? activeSection.title : (activeSection as Section).label}
                </Text>
                {isChapter(activeSection) && (
                  <TouchableOpacity onPress={() => handleRenameOpen(activeSection)} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={16} color={C.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Text input */}
              <TextInput
                style={[styles.textArea, { color: C.text }]}
                value={draftText}
                onChangeText={setDraftText}
                onBlur={handleTextBlur}
                multiline
                textAlignVertical="top"
                placeholder={`Write ${isChapter(activeSection) ? activeSection.title.toLowerCase() : (activeSection as Section).label.toLowerCase()} content here…`}
                placeholderTextColor={C.textSubtle}
                scrollEnabled={false}
              />
            </ScrollView>
          ) : (
            <View style={[styles.center, { flex: 1 }]}>
              <Text style={{ color: C.textMuted, fontSize: FontSize.base }}>Select a section to edit</Text>
              <TouchableOpacity onPress={() => setSidebarOpen(true)} style={{ marginTop: Space.sm }}>
                <Text style={{ color: C.accent, fontWeight: '600' }}>Open sections →</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>

      {/* ── Modals ── */}
      <MetadataModal
        visible={metaOpen}
        metadata={project.metadata}
        onClose={() => setMetaOpen(false)}
        onSave={fields => { updateMetadata(fields); setMetaOpen(false); }}
      />

      <AddChapterModal
        visible={addChapterModal}
        onClose={() => setAddChapterModal(false)}
        onAdd={addChapter}
      />

      <RenameModal
        visible={renameModal}
        current={renameTarget?.title ?? ''}
        onClose={() => { setRenameModal(false); setRenameTarget(null); }}
        onRename={title => renameTarget && renameChapter(renameTarget.id, title)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  center:  { alignItems: 'center', justifyContent: 'center' },
  body:    { flex: 1, flexDirection: 'row' },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Space.md, paddingBottom: Space.sm,
    borderBottomWidth: 1, gap: Space.sm,
  },
  titleWrap:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  topBarTitle:  { fontSize: FontSize.base, fontWeight: '700', flexShrink: 1 },
  topBarRight:  { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  iconBtn:      { padding: 4 },
  compileBtn:   {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Space.md, paddingVertical: 6, borderRadius: Radius.md,
  },
  compileBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },

  // Sidebar
  sidebar:        { width: 190, borderRightWidth: 1, paddingTop: Space.sm },
  sidebarSection: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: Space.md, paddingBottom: Space.xs },
  sidebarItem:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.md, paddingVertical: 10,
  },
  sidebarRow:  { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flex: 1, minWidth: 0 },
  sidebarLabel: { fontSize: FontSize.sm, fontWeight: '500', flex: 1 },
  dot:         { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  addBtn:      {
    flexDirection: 'row', alignItems: 'center', gap: Space.xs,
    margin: Space.md, padding: Space.sm,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.md,
  },
  addBtnText:  { fontSize: FontSize.sm, fontWeight: '600' },

  // Editor
  editorWrap:    { flex: 1 },
  editorScroll:  { flex: 1 },
  editorContent: { padding: Space.lg },
  sectionHead:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: Space.md, marginBottom: Space.md, borderBottomWidth: 1,
  },
  sectionTitle:  { fontSize: FontSize.xl, fontWeight: '800' },
  textArea:      { fontSize: FontSize.base, lineHeight: 26, minHeight: 400 },

  // Modal shared
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Space.xl },
  modalBox:    { borderRadius: Radius.lg, borderWidth: 1, padding: Space.xl, gap: Space.md },
  modalTitle:  { fontSize: FontSize.lg, fontWeight: '700' },
  modalActions:{ flexDirection: 'row', justifyContent: 'flex-end', gap: Space.sm, marginTop: Space.sm },

  // Metadata sheet
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.lg, paddingBottom: Space.md, borderBottomWidth: 1,
  },
  sheetTitle:  { fontSize: FontSize.md, fontWeight: '700' },
  sheetSave:   { fontSize: FontSize.base, fontWeight: '700' },
  sheetScroll: { padding: Space.lg },
  metaForm:    { gap: Space.md },
});
