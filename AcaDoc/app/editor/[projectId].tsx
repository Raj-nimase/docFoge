/**
 * EditorScreen — TenTap edition
 * Replaces the plain TextInput with a real TipTap rich-text editor via TenTap.
 * All backend / compile / drawer / modal logic is unchanged.
 */
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform,
  Animated, Keyboard, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// TenTap bridge is now a global singleton in GlobalEditor.tsx — no local import needed
import { useProjectStore, selectActiveProject, selectActiveSection } from '@/stores/projectStore';
import { useGlobalEditorStore } from '@/stores/editorStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { C, S, F, R, shadows } from '@/constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { apiStartCompile, apiPollUntilDone, pdfUrl, apiUploadImage, type Section, type Chapter, type TiptapDoc, type CompileStatus } from '@/services/api';
import { FormattingSheet, type FormatAction } from '@/components/ui/FormattingSheet';
import { AIAssistantSheet, type AIAction } from '@/components/ui/AIAssistantSheet';
import { DocumentDrawer } from '@/components/ui/DocumentDrawer';
import CompileOverlay, { type CompileStage } from '@/components/ui/CompileOverlay';
import PdfViewerModal from '@/components/ui/PdfViewerModal';

// ── Add chapter modal ─────────────────────────────────────────────────────────

const AddChapterModal = memo(function AddChapterModal({ visible, onClose, onAdd }: {
  visible: boolean; onClose: () => void; onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [err, setErr]     = useState('');
  function handleAdd() {
    if (!title.trim()) { setErr('Chapter title is required'); return; }
    onAdd(title.trim()); setTitle(''); setErr(''); onClose();
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ms.overlay} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity activeOpacity={1} style={ms.modalBox}>
          <Text style={ms.modalTitle}>Add Chapter</Text>
          <Input label="Chapter title" placeholder="e.g. Literature Review"
            value={title} onChangeText={v => { setTitle(v); setErr(''); }}
            error={err} autoFocus autoCapitalize="words" />
          <View style={ms.modalActions}>
            <Button label="Cancel" onPress={onClose} variant="ghost" fullWidth={false} />
            <Button label="Add" onPress={handleAdd} fullWidth={false} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

// ── Rename chapter modal ──────────────────────────────────────────────────────

const RenameModal = memo(function RenameModal({ visible, current, onClose, onRename }: {
  visible: boolean; current: string; onClose: () => void; onRename: (t: string) => void;
}) {
  const [title, setTitle] = useState(current);
  const [err, setErr]     = useState('');
  useEffect(() => { if (visible) setTitle(current); }, [visible, current]);
  function handleSave() {
    if (!title.trim()) { setErr('Title is required'); return; }
    onRename(title.trim()); onClose();
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ms.overlay} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity activeOpacity={1} style={ms.modalBox}>
          <Text style={ms.modalTitle}>Rename Chapter</Text>
          <Input label="Chapter title" value={title}
            onChangeText={v => { setTitle(v); setErr(''); }}
            error={err} autoFocus autoCapitalize="words" />
          <View style={ms.modalActions}>
            <Button label="Cancel" onPress={onClose} variant="ghost" fullWidth={false} />
            <Button label="Save" onPress={handleSave} fullWidth={false} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

// ── Metadata modal ────────────────────────────────────────────────────────────

const MetadataModal = memo(function MetadataModal({ visible, metadata, onClose, onSave }: {
  visible: boolean; metadata: Record<string, any>;
  onClose: () => void; onSave: (fields: Record<string, string>) => void;
}) {
  const insets = useSafeAreaInsets();
  const [fields, setFields] = useState({
    title: '', authors: '', institution: '', department: '', guide: '', year: '',
  });
  useEffect(() => {
    if (visible) setFields({
      title:       metadata?.title       ?? '',
      authors:     metadata?.authors     ?? '',
      institution: metadata?.institution ?? '',
      department:  metadata?.department  ?? '',
      guide:       metadata?.guide       ?? '',
      year:        metadata?.year        ?? '',
    });
  }, [visible, metadata]);
  const setF = (key: string, val: string) => setFields(f => ({ ...f, [key]: val }));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[ms.sheetHeader, { paddingTop: insets.top + S.sm }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={ms.sheetTitle}>Document Metadata</Text>
          <TouchableOpacity onPress={() => onSave(fields)}>
            <Text style={ms.sheetSave}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ms.sheetScroll}
          keyboardShouldPersistTaps="always" keyboardDismissMode="none">
          <View style={ms.metaForm}>
            <Input label="Title"              value={fields.title}       onChangeText={v => setF('title', v)}       placeholder="Document title"          autoCapitalize="words" />
            <Input label="Author(s)"          value={fields.authors}     onChangeText={v => setF('authors', v)}     placeholder="Name, Name"               autoCapitalize="words" />
            <Input label="Institution"        value={fields.institution} onChangeText={v => setF('institution', v)} placeholder="College / University"      autoCapitalize="words" />
            <Input label="Department"         value={fields.department}  onChangeText={v => setF('department', v)}  placeholder="e.g. Computer Engineering" autoCapitalize="words" />
            <Input label="Guide / Supervisor" value={fields.guide}       onChangeText={v => setF('guide', v)}       placeholder="Prof. Name"               autoCapitalize="words" />
            <Input label="Year"               value={fields.year}        onChangeText={v => setF('year', v)}        placeholder="2025" keyboardType="numeric" maxLength={4} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// ── Auto-save indicator ───────────────────────────────────────────────────────

const AutoSaveIndicator = memo(function AutoSaveIndicator({ saved }: { saved: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!saved) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [saved]);
  return (
    <Animated.View style={[es.autoSave, { opacity }]}>
      <Ionicons name="checkmark-circle" size={12} color={C.success} />
      <Text style={es.autoSaveText}>Saved</Text>
    </Animated.View>
  );
});

// ── Toolbar button ────────────────────────────────────────────────────────────

const ToolbarBtn = memo(function ToolbarBtn({ onPress, label, iconName, bold, italic, accent, active }: {
  onPress: () => void; label?: string; iconName?: string;
  bold?: boolean; italic?: boolean; accent?: boolean; active?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[es.toolbarBtn, accent && es.toolbarBtnAccent, active && es.toolbarBtnActive]}
      activeOpacity={0.7} hitSlop={4}>
      {iconName ? (
        <Ionicons name={iconName as any} size={20} color={accent ? C.accent : active ? C.accent : C.text} />
      ) : (
        <Text style={[
          es.toolbarBtnLabel,
          bold   && { fontWeight: '800' },
          italic && { fontStyle: 'italic' },
          active && { color: C.accent },
        ]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
});

// ── Auto-section IDs — generated by LaTeX backend, not user-editable ─────────
const AUTO_SECTION_IDS = new Set(['title_page', 'toc']);

function isAutoSection(id: string | undefined): boolean {
  return !!id && AUTO_SECTION_IDS.has(id);
}

// ── Auto-section notice — shown instead of the editor ────────────────────────
// Mirrors the web's "auto-section-notice" component in EditorPanel.jsx

const AUTO_SECTION_INFO: Record<string, { icon: string; title: string; hint: string }> = {
  title_page: {
    icon: 'home-outline',
    title: 'Title Page',
    hint:  'Generated automatically from your document settings (title, authors, institution, year). Tap ⬡ AcaDoc to edit those settings.',
  },
  toc: {
    icon: 'list-outline',
    title: 'Table of Contents',
    hint:  'Generated automatically from your chapter and section headings. It updates every time you compile.',
  },
};

const AutoSectionNotice = memo(function AutoSectionNotice({ sectionId }: { sectionId: string }) {
  const info = AUTO_SECTION_INFO[sectionId] ?? {
    icon: 'settings-outline',
    title: 'Auto-generated section',
    hint:  'This section is generated automatically from your document settings.',
  };
  return (
    <View style={an.wrap}>
      <View style={an.iconCircle}>
        <Ionicons name={info.icon as any} size={32} color={C.accentLight} />
      </View>
      <Text style={an.title}>{info.title}</Text>
      <Text style={an.body}>{info.hint}</Text>
      <View style={an.badge}>
        <Ionicons name="flash-outline" size={13} color={C.accentWarm} />
        <Text style={an.badgeText}>Auto-generated</Text>
      </View>
    </View>
  );
});

const an = StyleSheet.create({
  wrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: S.xl, gap: S.lg,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.accentGlow,
    borderWidth: 1, borderColor: C.accentMid,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: F.xl, fontWeight: '800', color: C.text,
    textAlign: 'center', letterSpacing: -0.3,
  },
  body: {
    fontSize: F.base, color: C.textMuted,
    textAlign: 'center', lineHeight: 22, maxWidth: 300,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    backgroundColor: C.warningBg,
    borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs,
  },
  badgeText: { fontSize: F.xs, fontWeight: '700', color: C.accentWarm, letterSpacing: 0.4 },
});






export default function EditorScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const insets = useSafeAreaInsets();

  // Narrow selectors — only re-render when the specific slice changes
  const project       = useProjectStore(selectActiveProject);
  const activeSection = useProjectStore(selectActiveSection);
  const activeChapterId    = useProjectStore(s => s.activeChapterId);
  const setActiveChapter   = useProjectStore(s => s.setActiveChapter);
  const updateSectionContent = useProjectStore(s => s.updateSectionContent);
  const updateMetadata     = useProjectStore(s => s.updateMetadata);
  const addChapter         = useProjectStore(s => s.addChapter);
  const deleteChapter      = useProjectStore(s => s.deleteChapter);
  const renameChapter      = useProjectStore(s => s.renameChapter);
  const openProject        = useProjectStore(s => s.openProject);

  const chapterIndex = project?.chapters.findIndex(c => c.id === activeChapterId) ?? -1;
  const chapterNumber = chapterIndex !== -1 ? chapterIndex + 1 : 1;

  useEffect(() => { if (projectId) openProject(projectId as string); }, [projectId]);

  // ── Cached JSON ref — always up to date, no async wait on switch ─────────
  const cachedJsonRef = useRef<TiptapDoc | null>(null);

  // webviewReady state removed — the native preview overlay was blocking ALL
  // touch events on Android (React Native views over WebViews intercept touches
  // regardless of pointerEvents="none"). Editor is always directly accessible.

  // ── editorState in React state so renders are batched properly ────────────
  // Calling editor.getEditorState() inline in render fires on every re-render
  // from any cause. Instead we subscribe once and store it in state.
  const [editorState, setEditorState] = useState<any>();

  const editor = useGlobalEditorStore(s => s.bridge);
  const setVisible = useGlobalEditorStore(s => s.setVisible);
  const setFrame = useGlobalEditorStore(s => s.setFrame);
  const setOnChangeCallback = useGlobalEditorStore(s => s.setOnChangeCallback);
  const setOnBlurCallback = useGlobalEditorStore(s => s.setOnBlurCallback);
  const setDrawerOpenGlobal = useGlobalEditorStore(s => s.setDrawerOpen);
  const setOnAddChapterCallback = useGlobalEditorStore(s => s.setOnAddChapterCallback);
  const setOnRenameChapterCallback = useGlobalEditorStore(s => s.setOnRenameChapterCallback);



  // ── Word count debounce ref — avoids getText() on every keystroke ─────────
  const wordCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Editor Bindings ────────────────────────────────────────────────────────
  useEffect(() => {
    setOnChangeCallback(() => {
      if (!editor) return;
      // Snapshot JSON into ref (fire and forget)
      editor.getJSON().then((json: any) => {
        cachedJsonRef.current = json as TiptapDoc;
      });

      // Debounce word count — only call getText() 500ms after typing stops
      if (wordCountTimerRef.current) clearTimeout(wordCountTimerRef.current);
      wordCountTimerRef.current = setTimeout(async () => {
        const text  = await editor.getText();
        const count = text.trim() ? text.trim().split(/\s+/).length : 0;
        setWordCount(count);
      }, 500);

      // Sync editor state for toolbar highlights
      setEditorState(editor.getEditorState());
    });
    return () => setOnChangeCallback(null);
  }, [editor, setOnChangeCallback]);

  // ── Subscribe to real-time editor bridge state updates ────────────────────
  useEffect(() => {
    if (!editor) return;
    setEditorState(editor.getEditorState());
    const unsubscribe = editor._subscribeToEditorStateUpdate((state: any) => {
      setEditorState(state);
    });
    return () => unsubscribe();
  }, [editor]);


  // ── UI state ───────────────────────────────────────────────────────────────
  const [savedFlash,      setSavedFlash]      = useState(false);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [fmtSheetOpen,    setFmtSheetOpen]    = useState(false);
  const [aiSheetOpen,     setAiSheetOpen]     = useState(false);
  const [addChapterModal, setAddChapterModal] = useState(false);
  const [renameModal,     setRenameModal]     = useState(false);
  const [renameTarget,    setRenameTarget]    = useState<Chapter | null>(null);
  const [metaOpen,        setMetaOpen]        = useState(false);
  const [aiLoading,       setAiLoading]       = useState<AIAction | null>(null);
  const [imageUploading,  setImageUploading]  = useState(false);
  const [wordCount,       setWordCount]       = useState(0);

  // ── Compile state ──────────────────────────────────────────────────────────
  const [compileStage,     setCompileStage]     = useState<CompileStage>('pending');
  const [compilePollCount, setCompilePollCount] = useState(0);
  const [compileElapsed,   setCompileElapsed]   = useState(0);
  const [compileVisible,   setCompileVisible]   = useState(false);
  const [pdfJobId,         setPdfJobId]         = useState('');
  const [pdfModalVisible,  setPdfModalVisible]  = useState(false);
  const compileTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Global Editor Visibility & Callbacks ──────────────────────────────────
  const placeholderRef = useRef<View>(null);

  const updateMeasurements = useCallback(() => {
    if (!placeholderRef.current) return;
    placeholderRef.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setFrame({ x, y, width, height });
      } else {
        // Layout pass not attached or ready yet on Android, retry in 100ms
        setTimeout(updateMeasurements, 100);
      }
    });
  }, [setFrame]);

  // Monitor keyboard shifts to update bounds
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', updateMeasurements);
    const hideSub = Keyboard.addListener('keyboardDidHide', updateMeasurements);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [updateMeasurements]);

  // Monitor transitions (drawers, switches) to re-evaluate dimensions
  useEffect(() => {
    const timer = setTimeout(updateMeasurements, 100);
    return () => clearTimeout(timer);
  }, [drawerOpen, activeChapterId, updateMeasurements]);

  const toggleDrawer = useCallback((open: boolean) => {
    setDrawerOpen(open);
    setDrawerOpenGlobal(open);
  }, [setDrawerOpenGlobal]);

  useEffect(() => {
    setVisible(true);
    setOnAddChapterCallback(() => {
      setAddChapterModal(true);
    });
    setOnRenameChapterCallback((c) => {
      setRenameTarget(c);
      setRenameModal(true);
    });
    return () => {
      setVisible(false);
      setOnAddChapterCallback(null);
      setOnRenameChapterCallback(null);
    };
  }, [setVisible, setOnAddChapterCallback, setOnRenameChapterCallback]);

  // ── Chapter switching & Content Loading ───────────────────────────────────
  const prevChapterIdRef = useRef<string | null>(null);
  const loadedChapterIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Flush cached JSON for the outgoing chapter
    if (prevChapterIdRef.current && prevChapterIdRef.current !== activeChapterId) {
      if (cachedJsonRef.current) {
        useProjectStore.getState().updateSectionContent(
          prevChapterIdRef.current,
          cachedJsonRef.current,
        );
        setSavedFlash(f => !f);
      }
    }
    prevChapterIdRef.current = activeChapterId;

    // Load incoming content into WebView — wait until bridge is ready
    if (!editorState?.isReady) return;

    if (activeChapterId !== loadedChapterIdRef.current) {
      loadedChapterIdRef.current = activeChapterId;
      cachedJsonRef.current = null;
      const incoming = activeSection?.content;
      editor?.setContent(incoming ?? '');
    }
  }, [activeChapterId, editorState?.isReady, chapterNumber, editor]);

  useEffect(() => {
    return () => {
      if (wordCountTimerRef.current)  clearTimeout(wordCountTimerRef.current);
      if (compileTimerRef.current)    clearInterval(compileTimerRef.current);
    };
  }, []);

  // ── Save on blur ──────────────────────────────────────────────────────────
  const handleEditorBlur = useCallback(async () => {
    if (!activeSection) return;
    // Use cached ref if available — avoids an extra bridge round-trip
    const json = cachedJsonRef.current ?? (await editor?.getJSON() as TiptapDoc);
    updateSectionContent(activeSection.id, json);
    setSavedFlash(f => !f);
  }, [activeSection, editor, updateSectionContent]);

  useEffect(() => {
    setOnBlurCallback(handleEditorBlur);
    return () => setOnBlurCallback(null);
  }, [handleEditorBlur, setOnBlurCallback]);

  // ── Format actions from FormattingSheet ───────────────────────────────────
  function handleFormat(action: FormatAction) {
    setFmtSheetOpen(false);
    switch (action) {
      case 'bold':        editor?.toggleBold();             break;
      case 'italic':      editor?.toggleItalic();           break;
      case 'underline':   editor?.toggleUnderline();        break;
      case 'strike':      editor?.toggleStrike();           break;
      case 'h1':          editor?.toggleHeading(1);         break;
      case 'h2':          editor?.toggleHeading(2);         break;
      case 'h3':          editor?.toggleHeading(3);         break;
      case 'bulletList':  editor?.toggleBulletList();       break;
      case 'orderedList': editor?.toggleOrderedList();      break;
      case 'blockquote':  editor?.toggleBlockquote();       break;
      case 'code':        editor?.toggleCode();             break;

      case 'link':
        Alert.prompt('Insert link', 'Enter URL', (url) => {
          if (!url?.trim()) return;
          // editor.setLink() is typed via LinkBridge — no cast needed.
          // Requires text to be selected first (canSetLink = !selection.empty).
          editor?.setLink(url.trim());
          editor?.focus();
        }, 'plain-text', 'https://');
        return;

    }
    editor?.focus();
  }

  const handleInsertImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const pickedUri = result.assets[0].uri;

      setImageUploading(true);
      const url = await apiUploadImage(pickedUri);
      
      if (editor) {
        editor.focus();
        editor.setImage(url);
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload image');
    } finally {
      setImageUploading(false);
    }
  };

  // ── AI stub ────────────────────────────────────────────────────────────────
  async function handleAIAction(action: AIAction) {
    setAiSheetOpen(false);
    const text = await editor?.getText();
    if (!text?.trim()) {
      Alert.alert('No content', 'Write some content first before using AI actions.');
      return;
    }
    setAiLoading(action);
    await new Promise(r => setTimeout(r, 1200));
    setAiLoading(null);
    Alert.alert('AI Assistant', `"${action}" action would run on your selected text.`);
  }

  // ── Compile — save first, then call backend ───────────────────────────────
  async function handleCompile() {
    if (activeSection) {
      // Use cached ref — no bridge round-trip needed before compile
      const json = cachedJsonRef.current ?? (await editor?.getJSON() as TiptapDoc);
      updateSectionContent(activeSection.id, json);
    }

    // Read fresh project from store (avoids stale closure)
    const freshProject = useProjectStore.getState().getActiveProject();
    if (!freshProject) return;

    setCompileStage('pending');
    setCompilePollCount(0);
    setCompileElapsed(0);
    setPdfJobId('');
    setCompileVisible(true);

    if (compileTimerRef.current) clearInterval(compileTimerRef.current);
    compileTimerRef.current = setInterval(() => setCompileElapsed(e => e + 1), 1000);

    try {
      const { jobId } = await apiStartCompile(freshProject);
      setCompileStage('processing');

      const final = await apiPollUntilDone(jobId, (s: CompileStatus) => {
        setCompileStage(s.status as CompileStage);
        setCompilePollCount(c => c + 1);
      });

      if (compileTimerRef.current) clearInterval(compileTimerRef.current);

      if (final.status === 'done') {
        setPdfJobId(jobId);
        setCompileVisible(false);
        setPdfModalVisible(true);
      } else {
        setCompileVisible(false);
        Alert.alert('Compilation failed', final.error ?? 'LaTeX returned an error.');
      }
    } catch (err: any) {
      if (compileTimerRef.current) clearInterval(compileTimerRef.current);
      setCompileVisible(false);
      Alert.alert('Compile error', err.message ?? 'Unknown error');
    }
  }

  // ── Chapter switch helper — instant, no async wait ───────────────────────
  // Flush the cached JSON synchronously (already kept up to date by onChange),
  // then switch immediately — no bridge round-trip before the ID changes.
  function switchToChapter(id: string) {
    if (activeSection && cachedJsonRef.current) {
      updateSectionContent(activeSection.id, cachedJsonRef.current);
    }
    setActiveChapter(id);
  }

  function handleDeleteChapter(c: Chapter) {
    Alert.alert('Delete chapter', `Delete "${c.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteChapter(c.id) },
    ]);
  }

  function handleRenameOpen(c: Chapter) { setRenameTarget(c); setRenameModal(true); }

  const isChapter = (s: Section | Chapter): s is Chapter =>
    project?.chapters.some(c => c.id === s.id) ?? false;

  const activeLabel = activeSection
    ? (isChapter(activeSection) ? activeSection.title : (activeSection as Section).label)
    : 'Select section';

  if (!project) {
    return (
      <View style={[es.screen, es.center, { backgroundColor: C.bg }]}>
        <Text style={{ color: C.textMuted }}>Project not found</Text>
      </View>
    );
  }

  return (
    <View style={[es.screen, { backgroundColor: C.bg }]}>

      {/* ── Top bar ── */}
      <View style={[es.topBar, { paddingTop: insets.top + S.xs }]}>
        <View style={es.topLeft}>
          <TouchableOpacity onPress={() => setMetaOpen(true)} style={es.topLogoWrap} hitSlop={6}>
            <Text style={es.topLogoHex}>⬡</Text>
            <Text style={es.topLogoName}>AcaDoc</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleCompile} style={es.buildBtn} activeOpacity={0.85}>
          <Ionicons name="play" size={12} color="#fff" />
          <Text style={es.buildBtnText}>Build PDF</Text>
        </TouchableOpacity>
      </View>



      {/* ── Editor body ── */}
      {activeSection ? (
        <View style={es.body}>
          {/* Section heading strip */}
          <View style={es.sectionHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <TouchableOpacity onPress={() => toggleDrawer(true)} hitSlop={8}>
                <Ionicons name="menu-outline" size={22} color={C.text} />
              </TouchableOpacity>
              <Text style={es.sectionTitle}>
                {isChapter(activeSection) ? activeSection.title : (activeSection as Section).label}
              </Text>
            </View>
            {isChapter(activeSection) && (
              <TouchableOpacity onPress={() => handleRenameOpen(activeSection)} hitSlop={8}>
                <Ionicons name="pencil-outline" size={15} color={C.textFaint} />
              </TouchableOpacity>
            )}
          </View>

          {/* Auto-generated sections (title_page / toc) — show notice, hide editor */}
          {isAutoSection(activeSection.id) ? (
            <AutoSectionNotice sectionId={activeSection.id} />
          ) : (
            <>
              {/* ── Top Grid Formatting Toolbar Box ── */}
              <View style={es.topToolbarContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={es.topToolbarScroll}
                  keyboardShouldPersistTaps="always"
                >
                  {/* TEXT STYLE */}
                  <ToolbarBtn onPress={() => handleFormat('bold')}
                    label="B" bold active={editorState?.isBoldActive} />
                  <ToolbarBtn onPress={() => handleFormat('italic')}
                    label="I" italic active={editorState?.isItalicActive} />
                  <ToolbarBtn onPress={() => handleFormat('underline')}
                    label="U" active={editorState?.isUnderlineActive} />
                  <ToolbarBtn onPress={() => handleFormat('strike')}
                    label="S" active={editorState?.isStrikeActive} />
                  <ToolbarBtn onPress={() => handleFormat('code')}
                    iconName="terminal-outline" active={editorState?.isCodeActive} />

                  <View style={es.topToolbarDivider} />

                  {/* HEADINGS */}
                  <ToolbarBtn onPress={() => handleFormat('h1')}
                    label="H1" active={editorState?.headingLevel === 1} />
                  <ToolbarBtn onPress={() => handleFormat('h2')}
                    label="H2" active={editorState?.headingLevel === 2} />
                  <ToolbarBtn onPress={() => handleFormat('h3')}
                    label="H3" active={editorState?.headingLevel === 3} />

                  <View style={es.topToolbarDivider} />

                  {/* LISTS / QUOTES / IMAGES */}
                  <ToolbarBtn onPress={() => handleFormat('bulletList')}
                    iconName="list-outline" active={editorState?.isBulletListActive} />
                  <ToolbarBtn onPress={() => handleFormat('orderedList')}
                    iconName="list-circle-outline" active={editorState?.isOrderedListActive} />
                  <ToolbarBtn onPress={() => handleFormat('blockquote')}
                    iconName="chatbox-outline" active={editorState?.isBlockquoteActive} />
                  <ToolbarBtn onPress={handleInsertImage}
                    iconName="image-outline" active={false} />
                </ScrollView>
              </View>

              <View 
                ref={placeholderRef}
                style={{ flex: 1, backgroundColor: 'transparent' }} 
                pointerEvents="none"
                onLayout={updateMeasurements}
              />

              {/* Footer */}
              <View style={es.editorFooter}>
                <Text style={es.wordCount}>{wordCount} word{wordCount !== 1 ? 's' : ''}</Text>
                <AutoSaveIndicator saved={savedFlash} />
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={es.center}>
          <Ionicons name="document-text-outline" size={48} color={C.borderStrong} />
          <Text style={es.emptyTitle}>No section selected</Text>
          <Text style={es.emptyText}>Open the drawer to choose a section</Text>
          <TouchableOpacity style={es.openDrawerBtn} onPress={() => toggleDrawer(true)}>
            <Ionicons name="menu-outline" size={16} color={C.accent} />
            <Text style={es.openDrawerText}>Open Sections</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom formatting toolbar removed — formatting toolbar is now sticky at the top of the editor */}



      <FormattingSheet
        visible={fmtSheetOpen}
        onClose={() => setFmtSheetOpen(false)}
        onAction={handleFormat}
      />
      <AIAssistantSheet
        visible={aiSheetOpen}
        onClose={() => setAiSheetOpen(false)}
        onAction={handleAIAction}
        loading={aiLoading}
      />

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

      <CompileOverlay
        visible={compileVisible}
        stage={compileStage}
        pollCount={compilePollCount}
        elapsed={compileElapsed}
        progressPct={compileStage === 'done' ? 100 : Math.min(90, 5 + compileElapsed * 5)}
      />
      <PdfViewerModal
        visible={pdfModalVisible}
        pdfRemoteUrl={pdfJobId ? pdfUrl(pdfJobId) : ''}
        title={project.metadata?.title ?? 'Document'}
        onClose={() => setPdfModalVisible(false)}
      />

      {imageUploading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(44,42,38,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={{ color: C.text, marginTop: 12, fontWeight: '700', fontSize: F.sm }}>Uploading image...</Text>
        </View>
      )}

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const es = StyleSheet.create({
  screen:  { flex: 1 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.md, paddingBottom: S.sm,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    ...shadows.card, gap: S.sm,
  },
  topLeft:     { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  topLogoWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topLogoHex:  { fontSize: 26, fontWeight: '700', color: C.accent },
  topLogoName: { fontSize: 20, fontWeight: '900', color: C.text, letterSpacing: -0.4 },
  iconBtn:     { padding: S.xs },

  chapterPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: C.cardAlt, borderRadius: R.full,
    paddingHorizontal: S.md, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  chapterPillText: { fontSize: F.sm, fontWeight: '600', color: C.text, flexShrink: 1 },

  buildBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.accent, paddingHorizontal: S.md,
    paddingVertical: 8, borderRadius: R.md,
  },
  buildBtnText: { fontSize: F.sm, fontWeight: '700', color: '#fff' },

  dropdown: {
    position: 'absolute', top: 56 + S.xs, left: S.xl, right: S.xl,
    backgroundColor: C.card, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border, zIndex: 200, ...shadows.strong,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.md, paddingVertical: S.md,
  },
  dropdownItemActive: { backgroundColor: C.accentGlow },
  dropdownText:       { fontSize: F.sm, color: C.text },

  body: { flex: 1 },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.lg, paddingVertical: S.sm,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  sectionTitle: { fontSize: F.lg, fontWeight: '800', color: C.text },

  // Native preview sits on top of the WebView — same background, no interaction
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.editorPaper,
    zIndex: 10,
  },
  previewContent: { padding: S.xl, paddingBottom: S.xl * 2 },

  editorFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.md, paddingVertical: S.xs,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  wordCount:    { fontSize: F.xs, color: C.textFaint },
  autoSave:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  autoSaveText: { fontSize: F.xs, color: C.success },

  emptyTitle: { fontSize: F.lg, fontWeight: '700', color: C.text },
  emptyText:  { fontSize: F.sm, color: C.textMuted },
  openDrawerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs,
    backgroundColor: C.accentGlow, borderWidth: 1, borderColor: C.accentMid,
    borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.sm, marginTop: S.xs,
  },
  openDrawerText: { fontSize: F.sm, fontWeight: '600', color: C.accent },

  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: S.md, paddingTop: S.sm, gap: S.xs, ...shadows.toolbar,
  },
  topToolbarContainer: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: S.xs,
  },
  topToolbarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    paddingHorizontal: S.md,
  },
  topToolbarDivider: {
    width: 1,
    height: 28,
    backgroundColor: C.border,
    marginHorizontal: S.xs,
  },
  toolbarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.md,
  },
  toolbarBtnAccent: { backgroundColor: C.accentGlow, borderWidth: 1, borderColor: C.accentMid },
  toolbarBtnActive: { backgroundColor: C.accentGlow },
  toolbarBtnLabel:  { fontSize: 17, fontWeight: '700', color: C.text },
  toolbarDivider:   { flex: 1 },
});

const ms = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(44,42,38,0.5)', justifyContent: 'center', padding: S.xl },
  modalBox:     { backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.xl, gap: S.md, ...shadows.strong },
  modalTitle:   { fontSize: F.lg, fontWeight: '700', color: C.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: S.sm, marginTop: S.sm },
  sheetHeader:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.lg, paddingBottom: S.md,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface,
  },
  sheetTitle:  { fontSize: F.md, fontWeight: '700', color: C.text },
  sheetSave:   { fontSize: F.base, fontWeight: '700', color: C.accent },
  sheetScroll: { padding: S.lg },
  metaForm:    { gap: S.md },
});
