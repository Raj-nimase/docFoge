/**
 * EditorScreen — TenTap edition
 * Replaces the plain TextInput with a real TipTap rich-text editor via TenTap.
 * All backend / compile / drawer / modal logic is unchanged.
 */
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform,
  Animated, Easing,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RichText, useEditorBridge, TenTapStartKit, BridgeExtension } from '@10play/tentap-editor';
import * as ImagePicker from 'expo-image-picker';
import { RichTextRenderer } from '@/components/ui/RichTextRenderer';
import { useProjectStore, selectActiveProject, selectActiveSection } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { C, S, F, R, shadows } from '@/constants/theme';
import type { Section, Chapter, TiptapDoc } from '@/services/api';
import { apiStartCompile, apiPollUntilDone, pdfUrl, getToken, API_BASE, type CompileStatus } from '@/services/api';
import { FormattingSheet, type FormatAction } from '@/components/ui/FormattingSheet';
import { AIAssistantSheet, type AIAction } from '@/components/ui/AIAssistantSheet';
import { DocumentDrawer } from '@/components/ui/DocumentDrawer';
import CompileOverlay, { type CompileStage } from '@/components/ui/CompileOverlay';
import PdfViewerModal from '@/components/ui/PdfViewerModal';
import { CUSTOM_EDITOR_HTML } from './_customHtml';

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

// ── Image name / caption modal ────────────────────────────────────────────────

const ImageNameModal = memo(function ImageNameModal({ visible, currentValue, onClose, onSave }: {
  visible: boolean; currentValue?: string; onClose: () => void; onSave: (name: string) => void;
}) {
  const [name, setName] = useState('');
  useEffect(() => { if (visible) setName(currentValue ?? ''); }, [visible, currentValue]);
  function handleSave() {
    onSave(name.trim());
    setName('');
    onClose();
  }
  function handleSkip() {
    onSave('');
    setName('');
    onClose();
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ms.overlay} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity activeOpacity={1} style={ms.modalBox}>
          <Text style={ms.modalTitle}>Figure Name</Text>
          <Text style={{ fontSize: F.sm, color: C.textMuted, marginBottom: S.xs }}>
            Give your figure a caption (e.g. "System Architecture Diagram"). This will appear below the image in your document.
          </Text>
          <Input label="Figure caption" placeholder="e.g. System Architecture Diagram"
            value={name} onChangeText={setName}
            autoFocus autoCapitalize="sentences" />
          <View style={ms.modalActions}>
            <Button label="Skip" onPress={handleSkip} variant="ghost" fullWidth={false} />
            <Button label="Save" onPress={handleSave} fullWidth={false} />
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

// ── WebView JS injection ──────────────────────────────────────────────────────
// This script is injected into TenTap's WebView via `customSource` before the
// editor boots. It does three things:
//
// 1. HeadingCleaner — strips "3.1 ", "a) " prefixes from headings on paste
//    (mirrors the web's HeadingCleaner ProseMirror plugin exactly)
//
// 2. Content Preservers — table, math, and image nodes synced from the web
//    are not in TenTap's schema, so TipTap would silently drop them on
//    setContent(). We patch setContent to convert them into legible equivalents
//    that TipTap *does* know:
//      table  → formatted paragraph block showing cell text (tab-separated rows)
//      math   → codeBlock with the raw LaTeX (preserves the formula text)
//      image  → paragraph with the image URL as a plain text link
//
//    This means content edited on web and synced to mobile won't lose data —
//    the user sees the content, edits it as normal text, and the LaTeX
//    generator still produces correct output when compiled.
//
// 3. transformPastedText — strips "---" markdown dividers from plain-text paste

const WEBVIEW_INJECT_JS = `
void (function() {
  'use strict';

  // ── Inject Custom Academic Styles ──────────────────────────────────────────
  (function injectStyles() {
    var style = document.getElementById('acadoc-custom-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'acadoc-custom-styles';
      (document.head || document.documentElement).appendChild(style);
    }
    style.innerHTML = 'html, body { ' +
      'height: 100% !important; ' +
      'margin: 0 !important; ' +
      'padding: 0 !important; ' +
      'background-color: #ffffff !important; ' +
      '} ' +
      '.ProseMirror, .tiptap { ' +
      'font-family: "Times New Roman", Times, serif !important; ' +
      'font-size: 8pt !important; ' +
      'line-height: 1.3 !important; ' +
      'color: #111111 !important; ' +
      'padding: 14px 12px 40vh 12px !important; /* Move large padding bottom here so lastChild bounding rect ends at text */' +
      'min-height: 100vh !important; ' +
      'cursor: text !important; ' +
      'box-sizing: border-box !important; ' +
      'background-color: #ffffff !important; ' +
      '} ' +
      '.ProseMirror h1 { ' +
      'font-size: 12pt !important; ' +
      'font-weight: bold !important; ' +
      'text-align: center !important; ' +
      'margin-top: 14px !important; ' +
      'margin-bottom: 6px !important; ' +
      'letter-spacing: -0.2px !important; ' +
      '} ' +
      '.ProseMirror h2 { ' +
      'font-size: 10.5pt !important; ' +
      'font-weight: bold !important; ' +
      'margin-top: 10px !important; ' +
      'margin-bottom: 5px !important; ' +
      '} ' +
      '.ProseMirror h3 { ' +
      'font-size: 9pt !important; ' +
      'font-weight: bold !important; ' +
      'margin-top: 8px !important; ' +
      'margin-bottom: 3px !important; ' +
      '} ' +
      '.ProseMirror p { ' +
      'margin-bottom: 6px !important; ' +
      'text-align: justify !important; ' +
      '} ' +
      '.ProseMirror blockquote { ' +
      'border-left: 2.5px solid #cbd5e1 !important; ' +
      'padding-left: 10px !important; ' +
      'margin: 10px 6px !important; ' +
      'font-style: italic !important; ' +
      'color: #475569 !important; ' +
      '} ' +
      '.ProseMirror pre, .ProseMirror code { ' +
      'font-family: monospace !important; ' +
      'background-color: #f1f5f9 !important; ' +
      'padding: 1px 3px !important; ' +
      'border-radius: 3px !important; ' +
      'font-size: 7.5pt !important; ' +
      '} ' +
      '.ProseMirror ul, .ProseMirror ol { ' +
      'margin-left: 14px !important; ' +
      'margin-bottom: 6px !important; ' +
      '} ' +
      '.image-view-wrapper { ' +
      'margin: 12px auto !important; ' +
      'display: block !important; ' +
      'text-align: center !important; ' +
      '} ' +
      '.acadoc-figure-caption { ' +
      'text-align: center !important; ' +
      'font-size: 7.5pt !important; ' +
      'color: #475569 !important; ' +
      'font-style: italic !important; ' +
      'margin: 4px auto 12px auto !important; ' +
      'padding: 0 12px !important; ' +
      '}';
  })();

  // ── Tap-Below-Content & Image Focus Handler ────────────────────────────────
  // Intercepts taps on:
  //   (1) Image tags — places cursor in a paragraph immediately after the image
  //   (2) Empty space below ALL content — appends an empty paragraph and focuses
  //       into it, giving a "write anywhere" feel like Word/Docs
  // Without this, ProseMirror only lets the cursor land inside existing nodes,
  // so tapping the large empty area below short content does nothing.
  var touchStartY = 0;
  document.addEventListener('touchstart', function(e) {
    if (e.touches && e.touches.length > 0) {
      touchStartY = e.touches[0].clientY;
    }
  }, true);

  function handleImageAndBackgroundTap(e) {
    var editor = window.__tiptapEditorRef;
    var clientY = e.clientY;
    if (clientY === undefined && e.changedTouches && e.changedTouches.length > 0) {
      clientY = e.changedTouches[0].clientY;
    }
    console.log('[WebView Tap Log] Type:', e.type, 'Target:', e.target ? e.target.tagName : 'none', 'Target ID/Class:', e.target ? (e.target.id || e.target.className) : '', 'clientY:', clientY);

    if (!editor) {
      var el = document.querySelector('.ProseMirror');
      var key = el && Object.keys(el).find(function(k) {
        return k.startsWith('__reactFiber') || k.startsWith('__reactInternals');
      });
      if (key) {
        var n = el[key], d = 0;
        while (n && d < 30) {
          if (n.memoizedProps && n.memoizedProps.editor &&
              typeof n.memoizedProps.editor.chain === 'function') {
            editor = n.memoizedProps.editor;
            window.__tiptapEditorRef = editor;
            break;
          }
          n = n.return; d++;
        }
      }
    }
    if (!editor) {
      console.log('[WebView Tap Log] Editor instance not resolved yet');
      return;
    }

    // Skip if it was a touch scroll gesture instead of a tap
    if (e.type === 'touchend' && clientY !== undefined) {
      if (Math.abs(clientY - touchStartY) > 10) {
        console.log('[WebView Tap Log] Ignored touch due to scroll gesture');
        return;
      }
    }

    // Case 1: Tapping directly on the image tag
    if (e.target && e.target.tagName === 'IMG') {
      console.log('[WebView Tap Log] Image tapped');
      var pos = editor.view.posAtDOM(e.target, 0);
      if (pos !== undefined && pos !== null) {
        var $pos = editor.state.doc.resolve(pos);
        var depth = $pos.depth;
        var endOfParent = depth > 0 ? $pos.after(depth) : pos + 1;
        var nextNode = editor.state.doc.nodeAt(endOfParent);
        
        setTimeout(function() {
          editor.chain().focus();
          if (!nextNode || nextNode.type.name !== 'paragraph') {
            editor.chain()
              .insertContentAt(endOfParent, '<p>&#8203;</p>')
              .setTextSelection(endOfParent + 2)
              .run();
          } else {
            editor.chain()
              .setTextSelection(endOfParent + 1)
              .run();
          }
        }, 50);
        
        e.stopPropagation();
      }
      return;
    }

    // Case 2: Tapping on empty space below the LAST content node (any type)
    // This gives the "write anywhere" feel: tapping below all content
    // appends an empty paragraph and focuses into it, so the keyboard
    // opens and the user can start typing immediately — just like Word.
    var pmEl = document.querySelector('.ProseMirror');
    if (pmEl && clientY !== undefined) {
      // Find the actual last rendered child element of the editor
      var lastChild = pmEl.lastElementChild;
      if (lastChild) {
        var lastRect = lastChild.getBoundingClientRect();
        console.log('[WebView Tap Log] Last child rect bottom:', lastRect.bottom, 'clientY:', clientY);
        // Only trigger when the tap is BELOW the bottom edge of the last node
        if (clientY > lastRect.bottom + 4) {
          // Check the tap target is the editor background, body, or an empty <p>
          var isBackground = e.target === pmEl ||
                             pmEl.contains(e.target) || // Loosened: target is inside editor bounds
                             e.target.tagName === 'BODY' ||
                             e.target.tagName === 'HTML';
          var tapText = e.target.textContent;
          var isEmptyP = e.target.tagName === 'P' &&
                         (!tapText || !tapText.replace(/[\u200B\s]/g, ''));

          console.log('[WebView Tap Log] Click is below last content node. isBackground:', isBackground, 'isEmptyP:', isEmptyP);

          if (isBackground || isEmptyP) {
            // Prevent WebView from placing selection focus back to the top/hit-test target
            e.preventDefault();
            e.stopPropagation();

            var docSize = editor.state.doc.content.size;
            var lastNode = editor.state.doc.lastChild;
            console.log('[WebView Tap Log] Processing focus/append. lastNode type:', lastNode ? lastNode.type.name : 'none');

            setTimeout(function() {
              var currentDoc = editor.state.doc;
              var currentLast = currentDoc.lastChild;
              var docSize = currentDoc.content.size;

              if (currentLast && currentLast.type.name === 'paragraph') {
                console.log('[WebView Tap Log] Focusing existing last paragraph');
                editor.chain()
                  .focus()
                  .setTextSelection(docSize - 1)
                  .run();
              } else {
                console.log('[WebView Tap Log] Appending new paragraph at end using ProseMirror tr');
                var pNode = editor.schema.nodes.paragraph.create();
                if (pNode) {
                  var tr = editor.state.tr.insert(docSize, pNode);
                  editor.view.dispatch(tr);
                }
                setTimeout(function() {
                  var newSize = editor.state.doc.content.size;
                  editor.chain()
                    .focus()
                    .setTextSelection(newSize - 1)
                    .run();
                }, 20);
              }
            }, 50);
          }
        }
      }
    }
  }

  document.addEventListener('click', handleImageAndBackgroundTap, { capture: true, passive: false });
  document.addEventListener('touchend', handleImageAndBackgroundTap, { capture: true, passive: false });

  // ── 1. Heading prefix stripper ─────────────────────────────────────────────
  function stripPrefixes(text) {
    var cleaned = text, prev;
    do {
      prev = cleaned;
      cleaned = cleaned.replace(/^\\s*\\d+(?:\\.\\d+)*(?:\\.\\s+|\\s+)/, '');
      cleaned = cleaned.replace(/^\\s*[a-zA-Z][.)]\\s+/, '');
      cleaned = cleaned.replace(/^\\s*(?:i{1,3}|iv|v|vi{0,3}|ix|x)[.)]\\s+/i, '');
    } while (cleaned !== prev);
    return cleaned;
  }

  // ── 2. Node converters — unknown → known TipTap schema equivalents ─────────

  // table → paragraph block showing rows as "col1  |  col2  |  col3" lines
  function tableToNodes(node) {
    var rows = node.content || [];
    var paragraphs = [];
    rows.forEach(function(row) {
      var cells = row.content || [];
      var cellTexts = cells.map(function(cell) {
        return (cell.content || [])
          .map(function(p) {
            return (p.content || []).map(function(n) { return n.text || ''; }).join('');
          }).join(' ');
      });
      var isHeader = cells.length && cells[0].type === 'tableHeader';
      var lineText = cellTexts.join('  |  ');
      paragraphs.push({
        type: isHeader ? 'heading' : 'paragraph',
        attrs: isHeader ? { level: 3 } : undefined,
        content: [{ type: 'text', text: lineText }],
      });
      if (isHeader) {
        // Separator line after header
        paragraphs.push({
          type: 'paragraph',
          content: [{ type: 'text', text: cells.map(function() { return '───' }).join('─┼─') }],
        });
      }
    });
    return paragraphs;
  }

  // math node → codeBlock with raw LaTeX
  function mathToNode(node) {
    var latex = (node.attrs && node.attrs.latex) ? node.attrs.latex : '';
    var display = node.attrs && node.attrs.display;
    return {
      type: 'codeBlock',
      attrs: { language: 'latex' },
      content: [{ type: 'text', text: display ? '\\\\[' + latex + '\\\\]' : '$' + latex + '$' }],
    };
  }

  // image node → paragraph with URL as plain text
  function imageToNode(node) {
    var src     = (node.attrs && node.attrs.src)   ? node.attrs.src   : '[image]';
    var caption = (node.attrs && node.attrs.title) ? node.attrs.title : '';
    var text = caption ? '[Image: ' + caption + '] ' + src : '[Image] ' + src;
    return { type: 'paragraph', content: [{ type: 'text', text: text }] };
  }

  // Walk a TipTap doc JSON and convert unsupported nodes in-place
  function normaliseDoc(node) {
    if (!node || typeof node !== 'object') return [node];
    if (node.type === 'table')  return tableToNodes(node);
    if (node.type === 'math' && node.attrs && node.attrs.display) return [mathToNode(node)];
    // Keep images as real image nodes instead of converting to paragraphs
    // if (node.type === 'image')  return [imageToNode(node)];

    if (node.content) {
      var newContent = [];
      node.content.forEach(function(child) {
        normaliseDoc(child).forEach(function(n) { newContent.push(n); });
      });
      return [Object.assign({}, node, { content: newContent })];
    }
    return [node];
  }

  // ── 3. Patch TipTap setContent via editor instance ────────────────────────
  //       Wait for the TipTap editor to appear (TenTap sets it up async).
  //       Once found, we wrap editor.commands.setContent so every setContent
  //       call (whether triggered by TenTap bridge or code) normalises the JSON
  //       before TipTap processes it.
  //       NOTE: Do NOT patch document/window.addEventListener — TenTap registers
  //       its bridge listeners at bundle load before any injected JS runs, so
  //       those patches are no-ops AND can corrupt the WebView messaging system.

  var scAttempts = 0;
  var scInterval = setInterval(function() {
    scAttempts++;
    if (scAttempts > 80) { clearInterval(scInterval); return; }

    var editorEl = document.querySelector('.ProseMirror');
    if (!editorEl) return;

    // Walk React fiber to find the TipTap editor instance
    var fiberKey = Object.keys(editorEl).find(function(k) {
      return k.startsWith('__reactFiber') || k.startsWith('__reactInternals');
    });
    if (!fiberKey) return;

    var tiptapEditor = null;
    var fNode = editorEl[fiberKey];
    var fDepth = 0;
    while (fNode && fDepth < 30) {
      if (fNode.memoizedProps && fNode.memoizedProps.editor &&
          typeof fNode.memoizedProps.editor.commands === 'object') {
        tiptapEditor = fNode.memoizedProps.editor;
        break;
      }
      fNode = fNode.return;
      fDepth++;
    }
    if (!tiptapEditor) return;
    if (tiptapEditor.__acadocNormalised) { clearInterval(scInterval); return; }
    tiptapEditor.__acadocNormalised = true;
    clearInterval(scInterval);

    // Cache for formula injectJS reuse
    window.__tiptapEditorRef = tiptapEditor;

    // Ensure trailing paragraph is present immediately on editor init
    try {
      var currentDoc = tiptapEditor.state.doc;
      var currentLast = currentDoc.lastChild;
      if (!currentLast || currentLast.type.name !== 'paragraph') {
        var endPos = currentDoc.content.size;
        var pNode = tiptapEditor.schema.nodes.paragraph.create();
        if (pNode) {
          var tr = tiptapEditor.state.tr.insert(endPos, pNode);
          tiptapEditor.view.dispatch(tr);
        }
      }
    } catch (e) { /* ignore */ }

    // Patch editor.commands.setContent so every setContent call normalises first
    // AND guarantees a trailing empty paragraph (so there's always somewhere to
    // tap and type after images, code blocks, tables, etc.)
    var _origSetContent = tiptapEditor.commands.setContent.bind(tiptapEditor.commands);
    tiptapEditor.commands.setContent = function(content, emitUpdate, parseOptions) {
      try {
        if (content && typeof content === 'object' && content.content) {
          var newContent = [];
          content.content.forEach(function(child) {
            normaliseDoc(child).forEach(function(n) { newContent.push(n); });
          });

          // Ensure trailing empty paragraph — without this, a doc ending in
          // an image/codeBlock/table has no valid cursor target after it.
          var last = newContent.length > 0 ? newContent[newContent.length - 1] : null;
          if (!last || last.type !== 'paragraph') {
            newContent.push({ type: 'paragraph' });
          }

          content = Object.assign({}, content, { content: newContent });
        }
      } catch(e) { /* fall through on error */ }
      return _origSetContent(content, emitUpdate, parseOptions);
    };
  }, 150);



  // ── HeadingCleaner via appendTransaction ────────────────────────────────
  // Runs after the editor is available, registered as a ProseMirror plugin
  var hcAttempts = 0;
  var hcInterval = setInterval(function() {
    hcAttempts++;
    if (hcAttempts > 60) { clearInterval(hcInterval); return; }

    // Look for the ProseMirror EditorView which is always attached to a DOM node
    var pmViews = [];
    document.querySelectorAll('.ProseMirror').forEach(function(el) {
      if (el.pmViewDesc && el.pmViewDesc.updateChildren) {
        pmViews.push(el);
      }
    });

    // Access via the global editor instance TenTap stores in its React context
    // TenTap 1.x stores the editor on the EditorContent element's __reactFiber
    var editorEl = document.querySelector('.ProseMirror');
    if (!editorEl) return;

    // Walk React fiber to find the TipTap editor instance
    var fiberKey = Object.keys(editorEl).find(function(k) {
      return k.startsWith('__reactFiber') || k.startsWith('__reactInternals');
    });
    if (!fiberKey) return;

    var fiber = editorEl[fiberKey];
    var tiptap = null;
    var node = fiber;
    var depth = 0;
    while (node && depth < 30) {
      if (node.memoizedProps && node.memoizedProps.editor &&
          typeof node.memoizedProps.editor.registerPlugin === 'function') {
        tiptap = node.memoizedProps.editor;
        break;
      }
      node = node.return;
      depth++;
    }

    if (!tiptap) return;
    clearInterval(hcInterval);

    // window.__tiptapEditorRef is set by scInterval above (same fiber walk).
    // If scInterval hasn't fired yet (race), set it here as well.
    if (!window.__tiptapEditorRef) window.__tiptapEditorRef = tiptap;

    // Use the view to patch dispatch
    var view = tiptap.view;
    if (!view) return;
    if (view.__acadocDispatchPatched) { clearInterval(hcInterval); return; }
    view.__acadocDispatchPatched = true;
    clearInterval(hcInterval);

    // Register custom static NodeView for images to render the caption nicely below the image
    try {
      var _origNodeViews = view.someProp('nodeViews') || {};
      view.setProps({
        nodeViews: Object.assign({}, _origNodeViews, {
          image: function(node, view, getPos) {
            var dom = document.createElement('div');
            dom.className = 'image-view-wrapper';
            
            var img = document.createElement('img');
            img.src = node.attrs.src;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.maxHeight = '240px';
            img.style.borderRadius = '4px';
            img.style.display = 'block';
            img.style.margin = '12px auto 4px auto';
            
            var caption = document.createElement('div');
            caption.className = 'acadoc-figure-caption';
            caption.textContent = node.attrs.title || '';
            caption.style.display = node.attrs.title ? 'block' : 'none';
            
            dom.appendChild(img);
            dom.appendChild(caption);
            
            return {
              dom: dom,
              selectNode: function() {
                dom.classList.add('selected');
                dom.style.boxShadow = '0 0 0 2px #0f172a';
                dom.style.borderRadius = '4px';
                dom.style.padding = '4px';
              },
              deselectNode: function() {
                dom.classList.remove('selected');
                dom.style.boxShadow = 'none';
                dom.style.padding = '0';
              },
              update: function(newNode) {
                if (newNode.type !== node.type) return false;
                node = newNode;
                img.src = node.attrs.src;
                caption.textContent = node.attrs.title || '';
                caption.style.display = node.attrs.title ? 'block' : 'none';
                return true;
              }
            };
          }
        })
      });
    } catch (e) {
      console.error('Error setting custom nodeViews:', e);
    }


    // Patch the dispatch transaction to clean headings and maintain a trailing paragraph
    var _origDispatch = view.dispatch.bind(view);
    view.dispatch = function(tr) {
      try {
        if (tr.docChanged) {
          var modifications = [];
          tr.doc.descendants(function(node, pos) {
            if (node.type.name !== 'heading') return true;
            if (!node.firstChild || !node.firstChild.isText) return false;
            var orig    = node.firstChild.text;
            var cleaned = stripPrefixes(orig);
            if (cleaned !== orig) {
              modifications.push({ from: pos + 1, to: pos + 1 + orig.length, text: cleaned });
            }
            return false;
          });

          // 1. Clean headings in place
          for (var i = modifications.length - 1; i >= 0; i--) {
            var m = modifications[i];
            tr.insertText(m.text, m.from, m.to);
          }

          // 2. Append trailing empty paragraph if the doc still ends with a non-paragraph node
          var lastNode = tr.doc.lastChild;
          if (!lastNode || lastNode.type.name !== 'paragraph') {
            var pNode = view.state.schema.nodes.paragraph.create();
            if (pNode) {
              tr.insert(tr.doc.content.size, pNode);
            }
          }
        }
      } catch (e) { /* ignore */ }

      // Dispatch the modified transaction containing all cleanups
      _origDispatch(tr);
    };

  }, 200);

})();
`;




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
  const [editorState, setEditorState] = useState<ReturnType<typeof editor.getEditorState>>();

  // ── Word count debounce ref — avoids getText() on every keystroke ─────────
  const wordCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── TenTap editor bridge ───────────────────────────────────────────────────
  const editor = useEditorBridge({
    bridgeExtensions: TenTapStartKit,
    autofocus:        false,
    avoidIosKeyboard: true,
    initialContent:   activeSection?.content ?? '',
    customSource:     CUSTOM_EDITOR_HTML,
    onChange: () => {
      // Snapshot JSON into ref (fire and forget)
      editor.getJSON().then(json => {
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
    },
  });

  // ── Subscribe to real-time editor bridge state updates ────────────────────
  useEffect(() => {
    const unsubscribe = editor._subscribeToEditorStateUpdate((state) => {
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
  const [chapterDropdown, setChapterDropdown] = useState(false);
  const [aiLoading,       setAiLoading]       = useState<AIAction | null>(null);
  const [imageNameModal,  setImageNameModal]  = useState(false);
  const [pendingImageUrl, setPendingImageUrl]  = useState<string | null>(null);
  const [editingCaption,  setEditingCaption]   = useState(false);
  const [wordCount,       setWordCount]       = useState(0);

  // ── Compile state ──────────────────────────────────────────────────────────
  const [compileStage,     setCompileStage]     = useState<CompileStage>('pending');
  const [compilePollCount, setCompilePollCount] = useState(0);
  const [compileElapsed,   setCompileElapsed]   = useState(0);
  const [compileVisible,   setCompileVisible]   = useState(false);
  const [pdfJobId,         setPdfJobId]         = useState('');
  const [pdfModalVisible,  setPdfModalVisible]  = useState(false);
  const compileTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);



  // ── Chapter switching & Content Loading ───────────────────────────────────
  const prevChapterIdRef = useRef<string | null>(null);

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
    cachedJsonRef.current = null;

    // Load incoming content into WebView — wait until bridge is ready
    if (!editorState?.isReady) return;
    const incoming = activeSection?.content;
    editor.injectJS(`window.chapterNumber = ${chapterNumber};`);
    editor.setContent(incoming ?? '');
  }, [activeChapterId, editorState?.isReady, chapterNumber]);

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
    const json = cachedJsonRef.current ?? (await editor.getJSON() as TiptapDoc);
    updateSectionContent(activeSection.id, json);
    setSavedFlash(f => !f);
  }, [activeSection, editor, updateSectionContent]);

  // ── Image picker + upload ─────────────────────────────────────────────────
  // Uses expo-image-picker to let the user choose from library or camera,
  // uploads to Cloudinary via the backend proxy, then inserts an image node
  // via TenTap's ImageBridge (editor.setImage).
  async function pickAndUploadImage(source: 'library' | 'camera') {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo library access is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
          allowsMultipleSelection: false,
        });
      }

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];

      // Convert local URI to a File-like object for the upload API
      // On React Native we use FormData with the uri directly
      const cleanUri = Platform.OS === 'android' ? decodeURI(asset.uri) : asset.uri;
      let mimeType = asset.mimeType ?? 'image/jpeg';
      if (mimeType === 'image/jpg') {
        mimeType = 'image/jpeg';
      }

      const formData = new FormData();
      formData.append('file', {
        uri:  cleanUri,
        name: asset.fileName ?? `photo_${Date.now()}.jpg`,
        type: mimeType,
      } as any);

      const token = getToken();
      const res = await fetch(`${API_BASE}/images/upload`, {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Upload failed');

      // Store the uploaded URL and show the name modal so the user can set a caption
      setPendingImageUrl(data.url);
      setImageNameModal(true);
    } catch (err: any) {
      Alert.alert('Image upload failed', err.message ?? 'Unknown error');
    }
  }

  // ── Insert image into editor with optional caption ────────────────────────
  function insertImageWithCaption(url: string, caption: string) {
    // Escape strings for safe JS embedding
    const escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedCaption = caption.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    editor.injectJS(`
      void (function() {
        try {
          var editor = window.__tiptapEditorRef;
          if (!editor) {
            var el = document.querySelector('.ProseMirror');
            var key = el && Object.keys(el).find(function(k) {
              return k.startsWith('__reactFiber') || k.startsWith('__reactInternals');
            });
            if (key) {
              var n = el[key], d = 0;
              while (n && d < 30) {
                if (n.memoizedProps && n.memoizedProps.editor &&
                    typeof n.memoizedProps.editor.chain === 'function') {
                  editor = n.memoizedProps.editor;
                  window.__tiptapEditorRef = editor;
                  break;
                }
                n = n.return; d++;
              }
            }
          }
          if (!editor) {
            console.error('Editor ref not found during image insertion');
            return;
          }

          var imgAttrs = { src: "${escapedUrl}" };
          var captionText = "${escapedCaption}";
          if (captionText) imgAttrs.title = captionText;

          editor.chain()
            .focus()
            .setImage(imgAttrs)
            .run();
        } catch (e) {
          console.error('Error inserting image:', e.message);
        }
      })();
    `);
  }

  // ── Handle image name modal save ──────────────────────────────────────────
  function handleImageNameSave(name: string) {
    if (editingCaption) {
      const escapedCaption = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      editor.injectJS(`
        void (function() {
          try {
            var editor = window.__tiptapEditorRef;
            if (editor) {
              editor.chain().focus().updateAttributes('image', { title: "${escapedCaption}" }).run();
            }
          } catch(e) {}
        })();
      `);
      setEditingCaption(false);
    } else if (pendingImageUrl) {
      insertImageWithCaption(pendingImageUrl, name);
      setPendingImageUrl(null);
    }
  }

  // ── Format actions from FormattingSheet ───────────────────────────────────
  function handleFormat(action: FormatAction) {
    setFmtSheetOpen(false);
    switch (action) {
      case 'bold':        editor.toggleBold();             break;
      case 'italic':      editor.toggleItalic();           break;
      case 'underline':   editor.toggleUnderline();        break;
      case 'strike':      editor.toggleStrike();           break;
      case 'h1':          editor.toggleHeading(1);         break;
      case 'h2':          editor.toggleHeading(2);         break;
      case 'h3':          editor.toggleHeading(3);         break;
      case 'bulletList':  editor.toggleBulletList();       break;
      case 'orderedList': editor.toggleOrderedList();      break;
      case 'blockquote':  editor.toggleBlockquote();       break;
      case 'codeBlock':
        editor.injectJS(`
          void (function() {
            var editor = window.__tiptapEditorRef;
            if (editor) editor.chain().focus().toggleCodeBlock().run();
          })();
        `);
        return;

      case 'image':
        // Show picker choice — library or camera
        Alert.alert('Insert image', 'Choose source', [
          { text: 'Photo Library', onPress: () => pickAndUploadImage('library') },
          { text: 'Camera',        onPress: () => pickAndUploadImage('camera') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return; // don't call editor.focus() yet — picker will take focus

      case 'formula':
        // Prompt for LaTeX — insert as a codeBlock with language="latex".
        // TenTap has no formula bridge so we inject JS directly into the
        // WebView to call TipTap's insertContent at the current cursor.
        // RichTextRenderer already renders codeBlock[latex] as a display block.
        Alert.prompt(
          'Insert formula',
          'Enter LaTeX (e.g. x = \\frac{-b}{2a})',
          (latex) => {
            if (!latex?.trim()) return;
            // Escape the LaTeX string for safe embedding in JS source
            const escaped = latex.trim()
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "\\'");
            editor.injectJS(`
              void (function() {
                var editor = window.__tiptapEditorRef;
                if (!editor) {
                  // Fallback: walk fiber to find it
                  var el = document.querySelector('.ProseMirror');
                  var key = el && Object.keys(el).find(function(k) {
                    return k.startsWith('__reactFiber') || k.startsWith('__reactInternals');
                  });
                  if (key) {
                    var n = el[key], d = 0;
                    while (n && d < 30) {
                      if (n.memoizedProps && n.memoizedProps.editor &&
                          typeof n.memoizedProps.editor.chain === 'function') {
                        editor = n.memoizedProps.editor;
                        window.__tiptapEditorRef = editor;
                        break;
                      }
                      n = n.return; d++;
                    }
                  }
                }
                if (editor) {
                  editor.chain().focus().insertContent({
                    type: 'codeBlock',
                    attrs: { language: 'latex' },
                    content: [{ type: 'text', text: '${escaped}' }]
                  }).run();
                }
              })();
            `);
          },
          'plain-text',
        );
        return;

      case 'table':
        // Prompt for columns and rows, and insert a text-based table grid template
        Alert.prompt(
          'Insert Table',
          'Enter columns and rows (e.g. 3x2)',
          (dim) => {
            if (!dim || !/^\d+x\d+$/.test(dim)) return;
            const [cols, rows] = dim.split('x').map(Number);
            if (cols <= 0 || rows <= 0 || cols > 10 || rows > 20) return;
            
            // Build the plaintext grid table
            let tableStr = '';
            // Headers
            const headers = [];
            for (let c = 1; c <= cols; c++) headers.push(`Header ${c}`);
            tableStr += headers.join('  |  ') + '\\n';
            
            // Separator line
            const seps = [];
            for (let c = 1; c <= cols; c++) seps.push('──────────');
            tableStr += seps.join('─┼─') + '\\n';
            
            // Rows
            for (let r = 1; r <= rows; r++) {
              const rowCells = [];
              for (let c = 1; c <= cols; c++) rowCells.push(`Cell ${r},${c}`);
              tableStr += rowCells.join('  |  ') + '\\n';
            }
            
            editor.injectJS(`
              void (function() {
                var editor = window.__tiptapEditorRef;
                if (editor) {
                  editor.chain().focus().insertContent({
                    type: 'paragraph',
                    content: [{ type: 'text', text: '${tableStr}' }]
                  }).run();
                }
              })();
            `);
          },
          'plain-text',
          '3x2'
        );
        return;

      case 'divider':
        editor.injectJS(`
          void (function() {
            var editor = window.__tiptapEditorRef;
            if (editor) {
              editor.chain().focus().setHorizontalRule().run();
            }
          })();
        `);
        return;

      case 'link':
        Alert.prompt('Insert link', 'Enter URL', (url) => {
          if (!url?.trim()) return;
          // editor.setLink() is typed via LinkBridge — no cast needed.
          // Requires text to be selected first (canSetLink = !selection.empty).
          editor.setLink(url.trim());
          editor.focus();
        }, 'plain-text', 'https://');
        return;



      case 'imageCaption':
        // Show the caption modal to edit the caption of the selected image
        setEditingCaption(true);
        setImageNameModal(true);
        return;

      default: break;
    }
    editor.focus();
  }

  // ── AI stub ────────────────────────────────────────────────────────────────
  async function handleAIAction(action: AIAction) {
    setAiSheetOpen(false);
    const text = await editor.getText();
    if (!text.trim()) {
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
      const json = cachedJsonRef.current ?? (await editor.getJSON() as TiptapDoc);
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
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={es.iconBtn} hitSlop={8}>
            <Ionicons name="menu-outline" size={24} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMetaOpen(true)} style={es.topLogoWrap} hitSlop={6}>
            <Text style={es.topLogoHex}>⬡</Text>
            <Text style={es.topLogoName}>AcaDoc</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={es.chapterPill}
          onPress={() => setChapterDropdown(v => !v)} activeOpacity={0.8}>
          <Text style={es.chapterPillText} numberOfLines={1}>{activeLabel}</Text>
          <Ionicons name="chevron-down" size={13} color={C.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCompile} style={es.buildBtn} activeOpacity={0.85}>
          <Ionicons name="play" size={12} color="#fff" />
          <Text style={es.buildBtnText}>Build PDF</Text>
        </TouchableOpacity>
      </View>

      {/* ── Chapter quick-dropdown ── */}
      {chapterDropdown && (
        <View style={es.dropdown}>
          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always">
            {/* Filter out auto-generated sections — match DocumentDrawer */}
            {[...project.frontMatter.filter(s => !AUTO_SECTION_IDS.has(s.id)), ...project.chapters].map(s => {
              const id  = (s as any).id;
              const lbl = (s as Chapter).title ?? (s as Section).label;
              return (
                <TouchableOpacity key={id}
                  style={[es.dropdownItem, activeChapterId === id && es.dropdownItemActive]}
                  onPress={() => { switchToChapter(id); setChapterDropdown(false); }}>
                  <Text style={[es.dropdownText, activeChapterId === id && { color: C.accent, fontWeight: '700' }]}>
                    {lbl}
                  </Text>
                  {activeChapterId === id && <Ionicons name="checkmark" size={14} color={C.accent} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Editor body ── */}
      {activeSection ? (
        <View style={es.body}>
          {/* Section heading strip */}
          <View style={es.sectionHead}>
            <Text style={es.sectionTitle}>
              {isChapter(activeSection) ? activeSection.title : (activeSection as Section).label}
            </Text>
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
                <View style={es.topToolbarScroll}>
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

                  {/* HEADINGS */}
                  <ToolbarBtn onPress={() => handleFormat('h1')}
                    label="H1" active={editorState?.headingLevel === 1} />
                  <ToolbarBtn onPress={() => handleFormat('h2')}
                    label="H2" active={editorState?.headingLevel === 2} />
                  <ToolbarBtn onPress={() => handleFormat('h3')}
                    label="H3" active={editorState?.headingLevel === 3} />

                  {/* LISTS / QUOTES */}
                  <ToolbarBtn onPress={() => handleFormat('bulletList')}
                    iconName="list-outline" active={editorState?.isBulletListActive} />
                  <ToolbarBtn onPress={() => handleFormat('orderedList')}
                    iconName="list-circle-outline" active={editorState?.isOrderedListActive} />
                  <ToolbarBtn onPress={() => handleFormat('blockquote')}
                    iconName="chatbox-outline" active={editorState?.isBlockquoteActive} />
                  <ToolbarBtn onPress={() => handleFormat('codeBlock')}
                    iconName="code-slash-outline" active={false} />

                  {/* INSERTS */}
                  <ToolbarBtn onPress={() => handleFormat('image')}
                    iconName="image-outline" />
                  <ToolbarBtn onPress={() => handleFormat('imageCaption')}
                    iconName="pricetag-outline" />
                  <ToolbarBtn onPress={() => handleFormat('table')}
                    iconName="grid-outline" />
                </View>
              </View>

              {/* TenTap WebView editor + tap catcher for empty space below */}
              <View style={{ flex: 1 }}>
                <RichText
                  editor={editor}
                  style={{ flex: 1 }}
                  onBlur={handleEditorBlur}
                  onLoad={() => {
                    editor.injectJS(`window.chapterNumber = ${chapterNumber}; window.dynamicHeight = true;`);
                  }}
                  originWhitelist={['*']}
                  mixedContentMode="always"
                  domStorageEnabled={true}
                  allowFileAccess={true}
                  allowUniversalAccessFromFileURLs={true}
                />
                {/* Android tap catcher — TenTap's RichText WebView auto-sizes
                    to content on some devices, leaving React Native View space
                    below that the WebView JS can't see. This catches taps on
                    that native empty space and focuses the editor at the end. */}
                <TouchableOpacity
                  activeOpacity={1}
                  style={{
                    minHeight: 120,
                    backgroundColor: '#ffffff',
                  }}
                  onPress={() => {
                    editor.focus('end');
                    // Also ensure a trailing paragraph exists via injected JS
                    editor.injectJS(`
                      void (function() {
                        var ed = window.__tiptapEditorRef;
                        if (!ed) return;
                        var last = ed.state.doc.lastChild;
                        var docSize = ed.state.doc.content.size;
                        if (!last || last.type.name !== 'paragraph') {
                          var pNode = ed.schema.nodes.paragraph.create();
                          if (pNode) {
                            var tr = ed.state.tr.insert(docSize, pNode);
                            ed.view.dispatch(tr);
                          }
                          setTimeout(function() {
                            var newSize = ed.state.doc.content.size;
                            ed.chain().focus().setTextSelection(newSize - 1).run();
                          }, 20);
                        } else {
                          ed.chain().focus().setTextSelection(docSize - 1).run();
                        }
                      })();
                    `);
                  }}
                />
              </View>

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
          <TouchableOpacity style={es.openDrawerBtn} onPress={() => setDrawerOpen(true)}>
            <Ionicons name="menu-outline" size={16} color={C.accent} />
            <Text style={es.openDrawerText}>Open Sections</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom formatting toolbar removed — formatting toolbar is now sticky at the top of the editor */}

      {/* ── Drawers, sheets, modals ── */}
      <DocumentDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        frontMatter={project.frontMatter}
        chapters={project.chapters}
        activeId={activeChapterId}
        onSelect={id => { switchToChapter(id); setDrawerOpen(false); }}
        onAddChapter={() => { setDrawerOpen(false); setAddChapterModal(true); }}
        onDeleteChapter={handleDeleteChapter}
        onRenameChapter={handleRenameOpen}
      />

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
      <ImageNameModal
        visible={imageNameModal}
        currentValue={editingCaption ? ((editorState as any)?.selectedImageTitle ?? '') : ''}
        onClose={() => { setImageNameModal(false); setPendingImageUrl(null); setEditingCaption(false); }}
        onSave={handleImageNameSave}
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
  topLogoWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  topLogoHex:  { fontSize: F.lg, color: C.accent },
  topLogoName: { fontSize: F.base, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
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
    paddingHorizontal: S.xs,
  },
  topToolbarScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.xs,
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
