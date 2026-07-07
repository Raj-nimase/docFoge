/**
 * PdfViewerModal
 * Full-screen modal that renders the compiled PDF.
 *
 * Strategy (no custom native modules — works in Expo Go):
 *   1. Download the PDF from the backend to a local temp file via expo-file-system.
 *   2. Render the local file:// URI inside a WebView.
 *      - iOS:     WKWebView renders PDFs natively.
 *      - Android: WebView renders PDFs via the built-in PDF renderer (Android 5+).
 * Download + share via expo-sharing.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Pdf from 'react-native-pdf';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { C, F, R, S, shadows } from '@/constants/theme';

interface Props {
  visible: boolean;
  /** Remote URL of the compiled PDF returned by pdfUrl(jobId) */
  pdfRemoteUrl: string;
  /** Human-readable title used for the downloaded filename */
  title: string;
  onClose: () => void;
}

export default function PdfViewerModal({ visible, pdfRemoteUrl, title, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [localUri,  setLocalUri]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [sharing,   setSharing]   = useState(false);
  const [webLoading,setWebLoading]= useState(true);

  // Download PDF to local storage whenever the modal opens with a new URL
  useEffect(() => {
    if (!visible || !pdfRemoteUrl) return;

    let cancelled = false;
    setLocalUri(null);
    setError(null);
    setLoading(true);
    setWebLoading(true);

    (async () => {
      try {
        const safeName = (title || 'document').replace(/[^a-z0-9]/gi, '_');
        const destFile = new File(Paths.cache, `${safeName}_preview.pdf`);

        // Delete stale copy if present
        try { await destFile.delete(); } catch { /* didn't exist */ }

        await File.downloadFileAsync(pdfRemoteUrl, destFile);
        if (cancelled) return;

        setLocalUri(destFile.uri);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Download failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, pdfRemoteUrl]);

  async function handleDownload() {
    if (!localUri) return;
    setSharing(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or share your PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Downloaded', `PDF saved to:\n${localUri}`);
      }
    } catch (err: any) {
      Alert.alert('Share failed', err.message);
    } finally {
      setSharing(false);
    }
  }

  function handleClose() {
    setLocalUri(null);
    setError(null);
    setLoading(false);
    setWebLoading(true);
    onClose();
  }


  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={st.safe}>

        {/* ── Top bar ── */}
        <View style={[st.topBar, { paddingTop: insets.top + S.sm, paddingBottom: S.sm }]}>
          <TouchableOpacity onPress={handleClose} style={st.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>

          <View style={st.topCenter}>
            <Text style={st.topTitle} numberOfLines={1}>{title || 'PDF Preview'}</Text>
            <Text style={st.topSub}>
              {loading ? 'Downloading…' : error ? 'Error' : 'Tap to scroll • Pinch to zoom'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleDownload}
            style={st.iconBtn}
            hitSlop={10}
            disabled={sharing || loading || !!error || !localUri}
          >
            {sharing
              ? <ActivityIndicator size="small" color={C.accent} />
              : <Ionicons
                  name="download-outline"
                  size={22}
                  color={(loading || !!error || !localUri) ? C.borderStrong : C.text}
                />
            }
          </TouchableOpacity>
        </View>

        {/* ── Body ── */}
        <View style={st.body}>

          {/* Downloading indicator */}
          {loading && (
            <View style={st.centerWrap}>
              <ActivityIndicator size="large" color={C.accent} />
              <Text style={st.loadingText}>Downloading PDF…</Text>
            </View>
          )}

          {/* Error state */}
          {!loading && error && (
            <View style={st.centerWrap}>
              <Ionicons name="close-circle" size={48} color={C.error} />
              <Text style={st.errorTitle}>Could not load PDF</Text>
              <Text style={st.errorMsg}>{error}</Text>
              <TouchableOpacity
                style={st.retryBtn}
                onPress={() => { setError(null); setLoading(true); }}
              >
                <Text style={st.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* WebView PDF renderer */}
          {!loading && !error && localUri && (
            <>
              {webLoading && (
                <View style={st.webLoadingOverlay}>
                  <ActivityIndicator size="large" color={C.accent} />
                  <Text style={st.loadingText}>Rendering PDF…</Text>
                </View>
              )}
              <Pdf
                source={{ uri: localUri }}
                style={st.webview}
                onLoadComplete={() => setWebLoading(false)}
                onError={(e: any) => {
                  setWebLoading(false);
                  setError(e?.message || 'Failed to render PDF');
                }}
                trustAllCerts={false}
              />
            </>
          )}
        </View>

        {/* ── Bottom bar ── */}
        {!loading && !error && localUri && !webLoading && (
          <View style={st.bottomBar}>
            <View style={st.hint}>
              <Ionicons name="information-circle-outline" size={14} color={C.textFaint} />
              <Text style={st.hintText}>Pinch to zoom • Scroll to read</Text>
            </View>

            <TouchableOpacity
              style={[st.downloadBtn, sharing && st.downloadBtnDisabled]}
              onPress={handleDownload}
              disabled={sharing}
              activeOpacity={0.82}
            >
              {sharing
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="share-outline" size={15} color="#fff" />
              }
              <Text style={st.downloadBtnText}>
                {sharing ? 'Preparing…' : 'Download & Share'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
    ...shadows.card,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.full,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  topTitle: {
    fontSize: F.base,
    fontWeight: '700',
    color: C.text,
  },
  topSub: {
    fontSize: F.xs,
    color: C.textMuted,
  },
  body: {
    flex: 1,
    backgroundColor: '#404040',
  },
  webview: {
    flex: 1,
    backgroundColor: '#404040',
  },
  webLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.md,
    zIndex: 10,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.xl,
    gap: S.md,
    backgroundColor: C.bg,
  },
  loadingText: {
    fontSize: F.sm,
    color: C.textMuted,
    marginTop: S.sm,
  },
  errorTitle: {
    fontSize: F.lg,
    fontWeight: '700',
    color: C.error,
  },
  errorMsg: {
    fontSize: F.sm,
    color: C.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: S.sm,
    paddingVertical: S.sm,
    paddingHorizontal: S.xl,
    borderRadius: R.full,
    backgroundColor: C.accentGlow,
    borderWidth: 1,
    borderColor: C.accent,
  },
  retryText: {
    fontSize: F.sm,
    fontWeight: '700',
    color: C.accent,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
    gap: S.md,
    ...shadows.sheet,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
  },
  hintText: {
    fontSize: F.xs,
    color: C.textFaint,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    backgroundColor: C.accent,
    paddingVertical: S.sm,
    paddingHorizontal: S.lg,
    borderRadius: R.full,
    ...shadows.card,
  },
  downloadBtnDisabled: {
    opacity: 0.6,
  },
  downloadBtnText: {
    fontSize: F.sm,
    fontWeight: '700',
    color: '#fff',
  },
});
