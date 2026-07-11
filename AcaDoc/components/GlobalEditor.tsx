import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { RichText, useEditorBridge, TenTapStartKit } from '@10play/tentap-editor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalEditorStore } from '@/stores/editorStore';
import { C } from '@/constants/theme';
import { useProjectStore } from '@/stores/projectStore';
import { KATEX_JS, KATEX_CSS } from '@/constants/katexBundle';

// Stream a large string into the WebView as a global, in chunks small enough to
// survive Android's evaluateJavascript size limit. `finalizeJS` runs once the
// full value is assembled (e.g. eval the library, or mount a <style>).
function injectChunked(
  editor: { injectJS: (js: string) => void },
  globalVar: string,
  content: string,
  finalizeJS: string,
) {
  const CHUNK = 16000;
  editor.injectJS('window.' + globalVar + '="";true;');
  for (let i = 0; i < content.length; i += CHUNK) {
    editor.injectJS('window.' + globalVar + '+=' + JSON.stringify(content.slice(i, i + CHUNK)) + ';true;');
  }
  editor.injectJS(finalizeJS + ';true;');
}

// Load offline KaTeX into the editor WebView: mount its stylesheet, then eval
// the library (indirect eval so it attaches to the global scope). Idempotent —
// skips work if the style/library are already present.
function injectKatexOffline(editor: { injectJS: (js: string) => void }) {
  injectChunked(
    editor,
    '__kxCss',
    KATEX_CSS,
    'if(!document.getElementById("katex-offline-style")){' +
      'var st=document.createElement("style");st.id="katex-offline-style";' +
      'st.textContent=window.__kxCss;document.head.appendChild(st);}',
  );
  injectChunked(
    editor,
    '__kxJs',
    KATEX_JS,
    'if(!window.katex){try{(0,eval)(window.__kxJs);}catch(e){' +
      'console.error("katex load failed:",(e&&e.message)||e);}}',
  );
}

export function GlobalEditor() {
  const visible = useGlobalEditorStore(s => s.visible);
  const frame = useGlobalEditorStore(s => s.frame);
  const isDropdownOpen = useGlobalEditorStore(s => s.isDropdownOpen);
  const isDrawerOpen = useGlobalEditorStore(s => s.isDrawerOpen);
  const setBridge = useGlobalEditorStore(s => s.setBridge);
  const insets = useSafeAreaInsets();
  const activeChapterId = useProjectStore(s => s.activeChapterId);

  const editor = useEditorBridge({
    bridgeExtensions: TenTapStartKit,
    autofocus: false,
    avoidIosKeyboard: true,
    onChange: () => {
      const cb = useGlobalEditorStore.getState().onChangeCallback;
      if (cb) cb();
    }
  });

  const katexInjectedRef = React.useRef(false);
  useEffect(() => {
    setBridge(editor);
    katexInjectedRef.current = false; // new WebView instance ⇒ re-stream KaTeX
    return () => setBridge(null);
  }, [editor, setBridge]);

  useEffect(() => {
    if (!editor || !activeChapterId) return;

    // Inject styles + scripts, but ONLY once the WebView editor reports ready.
    // A blind timer here was the cold-start bug: on first app launch the tentap
    // bundle is still loading, so a fixed-delay injectJS fired into a not-ready
    // WebView and the paste handler never registered — the first paste fell
    // through to plain text (no headings / no KaTeX). Typing a word merely bought
    // enough time for the editor to finish initializing, which is why it "worked
    // after typing". tentap only attaches `.ProseMirror.editor` once the editor
    // is created, so we gate on getEditorState().isReady and poll until it's
    // true, guaranteeing the handler is live before the user can paste.
    let cancelled = false;
    let attempts = 0;
    const inject = () => {
      if (cancelled) return;
      let ready = false;
      try { ready = !!editor.getEditorState?.().isReady; } catch { ready = false; }
      if (!ready) {
        if (attempts++ < 100) setTimeout(inject, 120); // wait out cold start (~12s cap)
        return;
      }
      editor.injectCSS(academicCSS, 'academic-theme');
      // Register the paste handler + nodeViews FIRST, before streaming KaTeX.
      // KaTeX is ~625 KB streamed as ~40 sequential injectJS round-trips; doing
      // that before imageCaptionJS left the editor with NO paste handler for a
      // second or more after load. imageCaptionJS registers a capture-phase
      // paste listener the instant it runs, so the very first paste is handled;
      // math then renders as soon as KaTeX finishes streaming (nodeView retries).
      editor.injectJS(imageCaptionJS);
      // Offline KaTeX (library + fonts embedded as base64 data: URIs), injected
      // locally so math renders with no network dependency. Android's
      // evaluateJavascript silently drops a single multi-hundred-KB payload, so
      // we stream the source into the WebView in small chunks, then eval it once.
      // Stream only once per WebView instance (~625 KB); the finalize step is
      // itself guarded, and the nodeView's retry loop re-renders math once KaTeX
      // appears.
      if (!katexInjectedRef.current) {
        katexInjectedRef.current = true;
        injectKatexOffline(editor);
      }
    };
    inject();

    return () => { cancelled = true; };
  }, [editor, activeChapterId]);

  const maxSeenHeightRef = React.useRef(0);
  if (visible && frame.height > maxSeenHeightRef.current) {
    maxSeenHeightRef.current = frame.height;
  }

  useEffect(() => {
    if (!visible) {
      maxSeenHeightRef.current = 0;
    }
  }, [visible]);

  const shouldShow = visible && frame.y > 100 && frame.height > 0;
  const calculatedTop = shouldShow ? frame.y + (Platform.OS === 'android' ? insets.top : 0) : -9999;

  return (
    <View style={[
      {
        position: 'absolute',
        top: calculatedTop,
        left: shouldShow ? frame.x : -9999,
        width: frame.width,
        height: Platform.OS === 'android' && maxSeenHeightRef.current > 0 ? maxSeenHeightRef.current : frame.height,
        backgroundColor: C.bg,
        zIndex: shouldShow ? 100 : -10,
      },
      !shouldShow && { pointerEvents: 'none' }
    ]}>
      <RichText
        editor={editor}
        style={{ flex: 1 }}
        onBlur={() => {
          const blurCb = useGlobalEditorStore.getState().onBlurCallback;
          if (blurCb) blurCb();
        }}
        exclusivelyUseCustomOnMessage={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'WEBVIEW_LOG') {
              console.log('[WebView Log]:', data.payload);
            } else if (data.type === 'WEBVIEW_ERROR') {
              console.error('[WebView Error]:', data.payload);
            }
          } catch (e) {}
        }}
        originWhitelist={['*']}
        mixedContentMode="always"
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
      />
    </View>
  );
}

const academicCSS = `
  body {
    background-color: #fbfaf7 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .ProseMirror {
    background-color: #ffffff !important;
    min-height: calc(100vh - 24px) !important;
    box-sizing: border-box !important;
    padding: 36px 28px 48px 28px !important;
    margin: 12px !important;
    border-radius: 4px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03) !important;
    font-family: 'Times New Roman', Times, Georgia, serif !important;
    font-size: 11px !important;
    line-height: 1.5 !important;
    color: #2c2a26 !important;
    outline: none !important;
  }
  .ProseMirror h1 {
    font-size: 15px !important;
    font-weight: 700 !important;
    margin-top: 18px !important;
    margin-bottom: 8px !important;
    color: #1a1a1a !important;
    text-align: center !important;
  }
  .ProseMirror h2 {
    font-size: 13px !important;
    font-weight: 700 !important;
    margin-top: 14px !important;
    margin-bottom: 6px !important;
    color: #1a1a1a !important;
  }
  .ProseMirror h3 {
    font-size: 11px !important;
    font-weight: 700 !important;
    margin-top: 12px !important;
    margin-bottom: 4px !important;
    color: #1a1a1a !important;
  }
  .ProseMirror p {
    margin-top: 0 !important;
    margin-bottom: 12px !important;
    text-align: justify !important;
  }
  .ProseMirror blockquote {
    border-left: 3px solid #dcdad5 !important;
    padding-left: 12px !important;
    color: #7c7a75 !important;
    font-style: italic !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    margin-top: 12px !important;
    margin-bottom: 12px !important;
  }
  .ProseMirror code {
    font-family: monospace !important;
    background-color: #f4f3ef !important;
    padding: 2px 4px !important;
    border-radius: 4px !important;
    font-size: 14px !important;
  }
  .ProseMirror ul, .ProseMirror ol {
    padding-left: 20px !important;
    margin-bottom: 12px !important;
  }
  .image-view-wrapper {
    margin: 1.5rem 0 !important;
    border-radius: 4px !important;
    padding: 8px !important;
  }
  .image-caption-input-wrap {
    display: flex !important;
    justify-content: center !important;
    z-index: 101 !important;
  }
  .image-caption-input {
    width: 80% !important;
    border: none !important;
    background: transparent !important;
    text-align: center !important;
    font-family: 'Times New Roman', Times, Georgia, serif !important;
    font-style: italic !important;
    font-size: 13px !important;
    color: #475569 !important;
    padding: 4px 8px !important;
    border-bottom: 1px solid transparent !important;
    transition: all 0.15s ease !important;
    outline: none !important;
  }
  .image-caption-input:hover {
    border-bottom-color: #cbd5e1 !important;
    color: #1a1a1a !important;
  }
  .image-caption-input:focus {
    border-bottom-color: #5d5a54 !important;
    color: #000000 !important;
    background: #f8fafc !important;
  }
  .image-container {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    width: 100% !important;
  }
  .ProseMirror img {
    max-width: 60% !important;
    display: block !important;
    margin-left: auto !important;
    margin-right: auto !important;
    height: auto !important;
    border-radius: 4px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
    margin-bottom: 8px !important;
  }
  .math-hidden-text {
    display: none !important;
  }
`;

const imageCaptionJS = `
  (function() {
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = function(...args) {
      originalLog.apply(console, args);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'WEBVIEW_LOG',
          payload: args.join(' ')
        }));
      }
    };
    
    console.error = function(...args) {
      originalError.apply(console, args);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'WEBVIEW_ERROR',
          payload: args.join(' ')
        }));
      }
    };

    // ── Math (KaTeX) carrier ──────────────────────────────────────────────────
    // TenTapStartKit has no math/codeBlock node, so we carry formulas on the
    // existing (schema-valid) 'image' leaf node: src='katexmath', alt=<latex>,
    // title='display'|'inline'. imageNodeView renders these with KaTeX. On save
    // they convert back to real 'math' nodes (see mapTextToMath) for the PDF.
    var KATEX_SRC = 'katexmath';
    var TABLE_SRC = 'tiptaptable';

    // Strip characters KaTeX can't render (U+FFFD '?', control, zero-width,
    // bidi marks) and escape a bare '%' (LaTeX comment char) so a stray unknown
    // glyph never turns the whole formula into a red error / raw-LaTeX fallback.
    function mmSanitizeLatex(latex) {
      var cleaned = (latex || '')
        .replace(/[\\uFFFD\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g, '')
        .replace(/(^|[^\\\\])%/g, '$1\\\\%');
      cleaned = cleaned.split('\\\\$').map(function(part) {
        return part.replace(/\\$/g, '');
      }).join('\\\\$');
      return cleaned;
    }
    // Last-resort strip: drop every non-ASCII glyph (e.g. a middle dot in
    // "N·m") so even math-mode text that mmSanitizeLatex kept can still parse.
    function mmStripUnknown(latex) {
      return (latex || '').replace(/[^\\x20-\\x7E]/g, '');
    }

    function mmImageMath(latex, display) {
      var clean = (latex || '').trim();
      while (true) {
        var start = clean;
        if (clean.startsWith('$$') && clean.endsWith('$$')) {
          clean = clean.slice(2, -2).trim();
        } else if (clean.startsWith('$') && clean.endsWith('$')) {
          clean = clean.slice(1, -1).trim();
        } else if (clean.startsWith('\\\\(') && clean.endsWith('\\\\)')) {
          clean = clean.slice(2, -2).trim();
        } else if (clean.startsWith('\\\\[') && clean.endsWith('\\\\]')) {
          clean = clean.slice(2, -2).trim();
        }
        if (clean === start) break;
      }
      var safe = mmSanitizeLatex(clean);
      return { type: 'image', attrs: { src: KATEX_SRC, alt: safe, title: display ? 'display' : 'inline' } };
    }

    function mmHasLatex(s) { return /[\\\\^_]/.test(s); }

    // Find the closing display delimiter, allowing it to sit mid-line (so "][" or
    // "]trailing" close correctly). Returns its index, or -1.
    function mmFindClose(s, delim) {
      if (delim === ']') { for (var j = 0; j < s.length; j++) if (s[j] === ']' && s[j - 1] !== '\\\\') return j; return -1; }
      return s.indexOf(delim);
    }

    // A variable-like token: single letter (optionally sub/superscripted) or a
    // LaTeX command. Used to detect "(X) = description" legend lines.
    function mmIsVar(s) {
      s = (s || '').trim();
      return /^[A-Za-z](_[A-Za-z0-9]+|\\^[A-Za-z0-9]+|_\\{[^}]+\\}|\\^\\{[^}]+\\})?$/.test(s) || /^\\\\[a-zA-Z]+(_[A-Za-z0-9]+)?$/.test(s);
    }

    // Escape prose so it is safe inside a LaTeX \\text{...}. Also normalise a few
    // typographic/unit glyphs to ASCII and drop any remaining non-ASCII character
    // KaTeX's text mode can't render (e.g. the middle dot in "N·m"), so a stray
    // unknown glyph never turns the whole formula into a red error.
    function mmTextEscape(s) {
      return (s || '')
        .replace(/[·⋅∙]/g, '')
        .replace(/[−–—]/g, '-')
        .replace(/×/g, 'x')
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[^\\x20-\\x7E]/g, '')
        .replace(/\\\\/g, '/').replace(/([%#&_$])/g, '\\\\$1').replace(/\\{/g, '\\\\{').replace(/\\}/g, '\\\\}').replace(/[\\^~]/g, '');
    }

    // Detect a "LHS = description" line where LHS is a short symbol or LaTeX
    // expression and the right-hand side is prose (a word or two, not itself an
    // equation) — e.g. "(S) = Slip (%)", "T = Torque (N·m)",
    // "\\cos\\phi = Power factor". Returns { lhs, rhs } (lhs as LaTeX) or null.
    // One layer of wrapping parens on the LHS — "(S)" — is stripped.
    function mmDefLine(s) {
      var eq = s.indexOf('=');
      if (eq <= 0) return null;
      if (s.charAt(eq + 1) === '=' || '<>!'.indexOf(s.charAt(eq - 1)) !== -1) return null; // ==, <=, >=, !=
      var lhs = s.slice(0, eq).trim(), rhs = s.slice(eq + 1).trim();
      if (!lhs || !rhs) return null;
      var pm = lhs.match(/^\\(([^)]{1,24})\\)$/);
      if (pm) lhs = pm[1].trim();
      // Strip any leading/trailing math delimiters from LHS
      while (true) {
        var start = lhs;
        if (lhs.startsWith('$$') && lhs.endsWith('$$')) {
          lhs = lhs.slice(2, -2).trim();
        } else if (lhs.startsWith('$') && lhs.endsWith('$')) {
          lhs = lhs.slice(1, -1).trim();
        } else if (lhs.startsWith('\\\\(') && lhs.endsWith('\\\\)')) {
          lhs = lhs.slice(2, -2).trim();
        } else if (lhs.startsWith('\\\\[') && lhs.endsWith('\\\\]')) {
          lhs = lhs.slice(2, -2).trim();
        }
        if (lhs === start) break;
      }
      // LHS must read as a symbol or LaTeX expression, not a sentence.
      var lhsOk = mmIsVar(lhs) || (/\\\\[a-zA-Z]/.test(lhs) && mmWordy(lhs) <= 3) || (lhs.length <= 12 && mmWordy(lhs) === 0);
      if (!lhsOk) return null;
      // RHS must read as a description: has a real word and isn't a formula.
      if (mmWordy(rhs) < 1 || mmMathScore(rhs)) return null;
      return { lhs: lhs, rhs: rhs };
    }

    function mmMatchBalanced(str, open, oc, cc) {
      var depth = 0;
      for (var j = open; j < str.length; j++) {
        var ch = str[j];
        if (ch === '\\\\') { j++; continue; }
        if (ch === oc) depth++;
        else if (ch === cc) { depth--; if (depth === 0) return j; }
      }
      return -1;
    }

    function mmScanInline(str) {
      var tokens = [], buf = '', i = 0;
      function pushText() { if (buf) { tokens.push({ t: 'text', v: buf }); buf = ''; } }
      while (i < str.length) {
        var c = str[i], n = str[i + 1];
        if (c === '\\\\' && n === '(') { var e = str.indexOf('\\\\)', i + 2); if (e !== -1) { pushText(); tokens.push({ t: 'math', v: str.slice(i + 2, e).trim() }); i = e + 2; continue; } }
        if (c === '\\\\' && n === '[') { var e2 = str.indexOf('\\\\]', i + 2); if (e2 !== -1) { pushText(); tokens.push({ t: 'math', v: str.slice(i + 2, e2).trim() }); i = e2 + 2; continue; } }
        if (c === '$') { var dbl = n === '$'; var d = dbl ? '$$' : '$'; var e3 = str.indexOf(d, i + d.length); if (e3 !== -1) { pushText(); tokens.push({ t: 'math', v: str.slice(i + d.length, e3).trim() }); i = e3 + d.length; continue; } }
        if (c === '(' && str[i - 1] !== '\\\\') { var e4 = mmMatchBalanced(str, i, '(', ')'); if (e4 !== -1) { var inner = str.slice(i + 1, e4); if (mmHasLatex(inner)) { pushText(); tokens.push({ t: 'math', v: inner.trim() }); i = e4 + 1; continue; } } }
        if (c === '[' && str[i - 1] !== '\\\\') { var e5 = mmMatchBalanced(str, i, '[', ']'); if (e5 !== -1) { var inner2 = str.slice(i + 1, e5); if (mmHasLatex(inner2)) { pushText(); tokens.push({ t: 'math', v: inner2.trim() }); i = e5 + 1; continue; } } }
        buf += c; i++;
      }
      pushText();
      return tokens;
    }

    function mmCleanText(s) { return s.replace(/\\*\\*(.+?)\\*\\*/g, '$1').replace(/\`([^\`]+)\`/g, '$1'); }

    // ── Unicode / HTML → LaTeX ────────────────────────────────────────────────
    // Copying math from a web page yields (a) rich text/html with <sup>/<sub>
    // and real symbols, or (b) lossy text/plain (² becomes a separate line, and
    // MathML glyphs become '?'). These helpers recover LaTeX from both.
    var MM_SUP = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-','⁼':'=','⁽':'(','⁾':')','ⁿ':'n','ⁱ':'i' };
    var MM_SUB = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','₌':'=','₍':'(','₎':')','ₙ':'n','ₓ':'x','ₐ':'a','ₑ':'e','ᵢ':'i','ⱼ':'j' };
    var MM_SYM = { '−':'-','–':'-','—':'-','×':'\\\\times ','÷':'\\\\div ','·':'\\\\cdot ','⋅':'\\\\cdot ','∗':'*','±':'\\\\pm ','∓':'\\\\mp ','≤':'\\\\le ','≥':'\\\\ge ','≠':'\\\\ne ','≈':'\\\\approx ','≡':'\\\\equiv ','∞':'\\\\infty ','∑':'\\\\sum ','∏':'\\\\prod ','∫':'\\\\int ','∂':'\\\\partial ','∇':'\\\\nabla ','√':'\\\\sqrt ','→':'\\\\to ','←':'\\\\gets ','⇒':'\\\\Rightarrow ','⇔':'\\\\Leftrightarrow ','∈':'\\\\in ','∉':'\\\\notin ','⊂':'\\\\subset ','⊆':'\\\\subseteq ','∪':'\\\\cup ','∩':'\\\\cap ','∅':'\\\\emptyset ','∀':'\\\\forall ','∃':'\\\\exists ','∝':'\\\\propto ','°':'^{\\\\circ}','α':'\\\\alpha ','β':'\\\\beta ','γ':'\\\\gamma ','δ':'\\\\delta ','ε':'\\\\epsilon ','ζ':'\\\\zeta ','η':'\\\\eta ','θ':'\\\\theta ','ι':'\\\\iota ','κ':'\\\\kappa ','λ':'\\\\lambda ','μ':'\\\\mu ','ν':'\\\\nu ','ξ':'\\\\xi ','π':'\\\\pi ','ρ':'\\\\rho ','σ':'\\\\sigma ','τ':'\\\\tau ','υ':'\\\\upsilon ','φ':'\\\\phi ','χ':'\\\\chi ','ψ':'\\\\psi ','ω':'\\\\omega ','Γ':'\\\\Gamma ','Δ':'\\\\Delta ','Θ':'\\\\Theta ','Λ':'\\\\Lambda ','Ξ':'\\\\Xi ','Π':'\\\\Pi ','Σ':'\\\\Sigma ','Φ':'\\\\Phi ','Ψ':'\\\\Psi ','Ω':'\\\\Omega ' };

    function mmConvUnicode(s) {
      if (!s) return s;
      s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/g, function (m) { var r = ''; for (var k = 0; k < m.length; k++) r += (MM_SUP[m[k]] || m[k]); return '^{' + r + '}'; });
      s = s.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₙₓₐₑᵢⱼ]+/g, function (m) { var r = ''; for (var k = 0; k < m.length; k++) r += (MM_SUB[m[k]] || m[k]); return '_{' + r + '}'; });
      s = s.replace(/[−–—×÷·⋅∗±∓≤≥≠≈≡∞∑∏∫∂∇√→←⇒⇔∈∉⊂⊆∪∩∅∀∃∝°αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΦΨΩ]/g, function (c) { return MM_SYM[c] || c; });
      return s;
    }

    // Recursively convert a DOM node (text, HTML sup/sub, or MathML) → LaTeX.
    function mmConvNode(ch) {
      if (ch.nodeType === 3) return mmConvUnicode(ch.nodeValue || '');
      if (ch.nodeType !== 1) return '';
      var tag = (ch.tagName || '').toLowerCase();
      if (tag === 'sup') return '^{' + mmConvChildren(ch).trim() + '}';
      if (tag === 'sub') return '_{' + mmConvChildren(ch).trim() + '}';
      if (tag === 'br') return ' ';
      if (tag === 'msup') { var a = mmElemKids(ch); return (a[0] || '') + '^{' + (a[1] || '') + '}'; }
      if (tag === 'msub') { var b = mmElemKids(ch); return (b[0] || '') + '_{' + (b[1] || '') + '}'; }
      if (tag === 'msubsup') { var c = mmElemKids(ch); return (c[0] || '') + '_{' + (c[1] || '') + '}^{' + (c[2] || '') + '}'; }
      if (tag === 'mfrac') { var f = mmElemKids(ch); return '\\\\frac{' + (f[0] || '') + '}{' + (f[1] || '') + '}'; }
      if (tag === 'msqrt') return '\\\\sqrt{' + mmConvChildren(ch).trim() + '}';
      if (tag === 'mroot') { var r = mmElemKids(ch); return '\\\\sqrt[' + (r[1] || '') + ']{' + (r[0] || '') + '}'; }
      return mmConvChildren(ch);
    }
    function mmConvChildren(node) { var o = '', k = node.childNodes; for (var i = 0; i < k.length; i++) o += mmConvNode(k[i]); return o; }
    function mmElemKids(node) { var res = [], k = node.childNodes; for (var i = 0; i < k.length; i++) if (k[i].nodeType === 1) res.push(mmConvNode(k[i]).trim()); return res; }

    var MM_BLOCK = { p:1, div:1, li:1, tr:1, h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, section:1, article:1, ul:1, ol:1, table:1, tbody:1, thead:1, blockquote:1, pre:1, dd:1, dt:1 };

    function mmDomToTableJSON(tableEl) {
      var rows = [];
      var trs = tableEl.querySelectorAll('tr');
      for (var r = 0; r < trs.length; r++) {
        var cells = [];
        var kids = trs[r].childNodes;
        for (var c = 0; c < kids.length; c++) {
          var cell = kids[c];
          if (cell.nodeType !== 1) continue;
          var cellTag = (cell.tagName || '').toLowerCase();
          if (cellTag === 'td' || cellTag === 'th') {
            var cellText = cell.textContent || '';
            cells.push({
              type: cellTag === 'th' ? 'tableHeader' : 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: cellText ? [{ type: 'text', text: cellText }] : []
                }
              ]
            });
          }
        }
        if (cells.length > 0) {
          rows.push({
            type: 'tableRow',
            content: cells
          });
        }
      }
      if (rows.length === 0) return null;
      var captionEl = tableEl.querySelector('caption');
      var caption = captionEl ? captionEl.textContent : '';
      return {
        type: 'table',
        attrs: { caption: caption || '' },
        content: rows
      };
    }

    // Split pasted HTML into logical lines: { tag, latex }.
    function mmHtmlBlocks(root) {
      var blocks = [];
      function walk(node) {
        var tag = (node.tagName || '').toLowerCase();
        if (tag === 'table') {
          var tableJSON = mmDomToTableJSON(node);
          if (tableJSON) {
            blocks.push({ tag: 'tiptaptable', latex: JSON.stringify(tableJSON) });
          }
          return;
        }

        var kids = node.childNodes, hasBlock = false;
        for (var i = 0; i < kids.length; i++) { var c = kids[i]; if (c.nodeType === 1 && MM_BLOCK[(c.tagName || '').toLowerCase()]) { hasBlock = true; break; } }
        if (hasBlock) {
          for (var j = 0; j < kids.length; j++) {
            var c2 = kids[j];
            if (c2.nodeType === 1 && MM_BLOCK[(c2.tagName || '').toLowerCase()]) { walk(c2); continue; }
            var lx = mmConvNode(c2);
            if (lx && lx.trim()) blocks.push({ tag: (node.tagName || '').toLowerCase(), latex: lx });
          }
        } else {
          // Leaf block: emit its inline content, splitting on <br>.
          var line = '';
          function flush() { if (line && line.trim()) blocks.push({ tag: (node.tagName || '').toLowerCase(), latex: line }); line = ''; }
          for (var m = 0; m < kids.length; m++) {
            var ch = kids[m];
            if (ch.nodeType === 1 && (ch.tagName || '').toLowerCase() === 'br') { flush(); continue; }
            line += mmConvNode(ch);
          }
          flush();
        }
      }
      walk(root);
      return blocks;
    }

    function mmWordy(s) { var m = s.match(/[A-Za-z]{3,}/g); return m ? m.length : 0; }
    function mmMathScore(L) {
      var hasStruct = /\\^\\{|_\\{|\\\\[a-zA-Z]/.test(L);
      var hasOps = /[=+×÷±√]|[-](?=[0-9a-zA-Z(])/.test(L);
      return hasStruct || (hasOps && mmWordy(L) <= 3);
    }
    function mmTopColon(s) { var d = 0; for (var i = 0; i < s.length; i++) { var c = s[i]; if (c === '{') d++; else if (c === '}') d--; else if (c === ':' && d === 0) return i; } return -1; }

    // Pasted HTML → node JSON (paragraphs / headings / image-carrier math).
    function mmParseHtml(html) {
      var container = document.createElement('div');
      container.innerHTML = html;
      var blocks = mmHtmlBlocks(container), out = [];
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].tag === 'tiptaptable') {
          out.push({
            type: 'image',
            attrs: {
              src: 'tiptaptable',
              alt: blocks[i].latex,
              title: ''
            }
          });
          continue;
        }

        var L = blocks[i].latex.replace(/\\s+/g, ' ').trim();
        if (!L) continue;
        var dfn = mmDefLine(L);
        if (dfn) { out.push(mmImageMath(dfn.lhs + ' = \\\\text{' + mmTextEscape(dfn.rhs) + '}', false)); continue; }
        var isMath = mmMathScore(L) && (mmWordy(L) <= 5 || L.indexOf(':') !== -1);
        var hm = /^h([1-6])$/.exec(blocks[i].tag);
        if (hm && !isMath) { out.push({ type: 'heading', attrs: { level: Math.min(+hm[1], 3) }, content: [{ type: 'text', text: mmCleanText(L) }] }); continue; }
        if (isMath) {
          var ci = mmTopColon(L);
          if (ci > 0) {
            var label = L.slice(0, ci).replace(/[{}\\\\^_]/g, '').trim();
            var formula = L.slice(ci + 1).trim();
            if (label && /[A-Za-z]/.test(label) && formula) {
              out.push({ type: 'paragraph', content: [{ type: 'text', text: label + ':' }] });
              out.push(mmImageMath(formula, true));
              continue;
            }
          }
          out.push(mmImageMath(L, true));
        } else {
          out.push({ type: 'paragraph', content: [{ type: 'text', text: mmCleanText(L) }] });
        }
      }
      if (!out.length) out.push({ type: 'paragraph', content: [] });
      return out;
    }

    // A logical line → block nodes: text runs become paragraphs, math groups
    // become image-carrier math nodes (image is block-level, so each renders
    // on its own line — acceptable for formula sheets).
    function mmInlineToNodes(raw) {
      var tokens = mmScanInline(raw), nodes = [], textRuns = [];
      function flushText() {
        var joined = textRuns.join('').trim(); textRuns = [];
        if (joined) nodes.push({ type: 'paragraph', content: [{ type: 'text', text: mmCleanText(joined) }] });
      }
      for (var k = 0; k < tokens.length; k++) {
        var tk = tokens[k];
        if (tk.t === 'math') { flushText(); if (tk.v) nodes.push(mmImageMath(tk.v, false)); }
        else textRuns.push(tk.v);
      }
      flushText();
      if (nodes.length === 0) nodes.push({ type: 'paragraph', content: [] });
      return nodes;
    }

    function mmParse(text) {
      var lines = text.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n').split('\\n');
      var out = [], list = null, headingSeen = false;
      function flushList() { if (list && list.content.length) out.push(list); list = null; }

      var isTableRow = function(l) { return /^\\s*\\|.*\\|\\s*$/.test(l); };
      var isTableSep = function(l) { return /^\\s*\\|?[\\s:|-]*-[\\s:|-]*\\|?\\s*$/.test(l) && l.indexOf('-') !== -1; };
      var splitTableRow = function(l) {
        var s = l.trim();
        if (s.startsWith('|')) s = s.slice(1);
        if (s.endsWith('|')) s = s.slice(0, -1);
        return s.split('|').map(function(c) { return c.trim(); });
      };

      var i = 0;
      while (i < lines.length) {
        var line = lines[i], trimmed = line.trim();
        if (trimmed === '') { flushList(); i++; continue; }

        // Horizontal rule ("---", "***", "___") → skip entirely to keep document clean
        if (/^[-*_]{3,}$/.test(trimmed)) { flushList(); i++; continue; }

        // Markdown pipe table: a "| a | b |" header row followed by a
        // "| --- | --- |" separator, then "| … | … |" body rows → a real table image-carrier.
        if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
          flushList();
          var header = splitTableRow(line);
          var cols = header.length;
          i += 2; // consume header + separator
          var body = [];
          while (i < lines.length && isTableRow(lines[i]) && !isTableSep(lines[i])) {
            body.push(splitTableRow(lines[i]));
            i++;
          }
          
          var fit = function(row) {
            var r = row.slice(0, cols);
            while (r.length < cols) r.push('');
            return r;
          };
          
          var makeCell = function(contentText, cellType) {
            return {
              type: cellType,
              content: [
                {
                  type: 'paragraph',
                  content: contentText ? [{ type: 'text', text: contentText }] : []
                }
              ]
            };
          };

          var headerRowCells = fit(header).map(function(c) {
            return makeCell(c, 'tableHeader');
          });
          
          var rows = [{
            type: 'tableRow',
            content: headerRowCells
          }];
          
          for (var rIndex = 0; rIndex < body.length; rIndex++) {
            var bodyRowCells = fit(body[rIndex]).map(function(c) {
              return makeCell(c, 'tableCell');
            });
            rows.push({
              type: 'tableRow',
              content: bodyRowCells
            });
          }
          
          var tableJSON = {
            type: 'table',
            attrs: { caption: '' },
            content: rows
          };
          
          out.push({
            type: 'image',
            attrs: {
              src: 'tiptaptable',
              alt: JSON.stringify(tableJSON),
              title: ''
            }
          });
          continue;
        }

        // Display-math fence, opened by a line that is just  [ , \[ or $$ . The
        // close delimiter may sit mid-line — e.g. "][" (next block) or "]text"
        // (trailing prose) — so we scan for it and reprocess any remainder.
        var openDelim = null, closeDelim = null;
        if (trimmed === '[') { openDelim = '['; closeDelim = ']'; }
        else if (trimmed === '\\\\[') { openDelim = '\\\\['; closeDelim = '\\\\]'; }
        else if (trimmed === '$$') { openDelim = '$$'; closeDelim = '$$'; }
        if (openDelim) {
          var body = []; i++;
          var remainder = '';
          while (i < lines.length) {
            var cl = lines[i], idx = mmFindClose(cl, closeDelim);
            if (idx !== -1) {
              var before = cl.slice(0, idx);
              if (before.trim()) body.push(before);
              remainder = cl.slice(idx + closeDelim.length);
              if (remainder && remainder.trim()) { lines[i] = remainder; } else { i++; }
              break;
            }
            body.push(cl); i++;
          }
          var mathNode = mmImageMath(body.join(' ').replace(/\\s+/g, ' ').trim(), true);
          if (list && list.content.length && /^\\s/.test(line)) {
            list.content[list.content.length - 1].content.push(mathNode);
          } else { flushList(); out.push(mathNode); }
          continue;
        }

        var hm = trimmed.match(/^(#{1,6})\\s+(.*)$/);
        if (hm) { flushList(); out.push({ type: 'heading', attrs: { level: Math.min(hm[1].length, 3) }, content: [{ type: 'text', text: mmCleanText(hm[2]) }] }); i++; continue; }

        var bm = line.match(/^\\s*[*\\-+]\\s+(.*)$/);
        if (bm) {
          var bItem = bm[1].trim();
          // A "- X = description" legend item (e.g. "- T = Torque (N·m)",
          // "- \cos\phi = Power factor") reads as a definition, not a real list
          // entry. Emit it as its own KaTeX line (X = \text{description}) like a
          // standalone def line, ending the current bullet list. Without this the
          // '=' legend under a "Where:" block stayed as raw bulleted text.
          var bdef = mmDefLine(bItem);
          if (bdef) {
            flushList();
            out.push(mmImageMath(bdef.lhs + ' = \\\\text{' + mmTextEscape(bdef.rhs) + '}', false));
            i++; continue;
          }
          if (!list) list = { type: 'bulletList', content: [] };
          var itemNodes = mmInlineToNodes(bItem);
          if (!itemNodes.length || itemNodes[0].type !== 'paragraph') { itemNodes.unshift({ type: 'paragraph', content: [] }); }
          list.content.push({ type: 'listItem', content: itemNodes });
          i++; continue;
        }

        // Plain-text heading detection — pasted prose rarely uses '#'. A line is a
        // heading when it stands alone (blank line before AND after), is short,
        // contains a letter, doesn't end like a sentence (no . : , ;) and isn't a
        // formula/def line. Numbered "N. Title" lines (e.g. "1. Induction Motor",
        // "2. Slip") become sub-headings. The first heading is the document title
        // (h1); later plain headings are h2; numbered ones are h3.
        var prevBlank = (i === 0) || (lines[i - 1].trim() === '');
        var nextBlank = (i === lines.length - 1) || (lines[i + 1].trim() === '');
        var numHead = trimmed.match(/^\\d+[.)]\\s+(.+)$/);
        var headText = (numHead ? numHead[1] : trimmed).trim();
        var headWords = headText.split(/\\s+/).length;
        if (prevBlank && nextBlank && headText.length <= 64 && headWords <= 8 &&
            /[A-Za-z]/.test(headText) && !/[.:,;]$/.test(headText) &&
            !mmLooksMathy(headText) && !mmMathScore(headText) && !mmDefLine(trimmed)) {
          flushList();
          var lvl = numHead ? 3 : (headingSeen ? 2 : 1);
          headingSeen = true;
          out.push({ type: 'heading', attrs: { level: lvl }, content: [{ type: 'text', text: mmCleanText(headText) }] });
          i++; continue;
        }

        // Definition / legend line: a short math-ish left-hand side, "=", then a
        // natural-language description — "(S) = Slip (%)", "T = Torque (N·m)",
        // "\cos\phi = Power factor". Wrap the description in \text{} so its words
        // don't become mashed-together math italics and stray unit glyphs don't
        // break KaTeX.
        var defn = mmDefLine(trimmed);
        if (defn) {
          flushList();
          out.push(mmImageMath(defn.lhs + ' = \\\\text{' + mmTextEscape(defn.rhs) + '}', false));
          i++; continue;
        }

        flushList();
        var convLine = mmConvUnicode(trimmed);
        var hasExplicitLatex = /\\\\[a-zA-Z]+/.test(trimmed) && mmWordy(trimmed) <= 10;
        if (hasExplicitLatex || (convLine !== trimmed && mmMathScore(convLine) && mmWordy(convLine) <= 4)) {
          out.push(mmImageMath(convLine.replace(/\\s+/g, ' ').trim(), true));
          i++; continue;
        }
        var pnodes = mmInlineToNodes(trimmed);
        for (var p = 0; p < pnodes.length; p++) out.push(pnodes[p]);
        i++;
      }
      flushList();
      return out;
    }

    function mmLooksMathy(text) {
      return /[\\\\]/.test(text) || /[\\^_]\\s*[{0-9a-zA-Z]/.test(text) || /\\$\\$?[^$]+\\$\\$?/.test(text) || /[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/.test(text) || /[√∑∏∫∞±≤≥≠×÷∈∂]/.test(text);
    }

    // Read the pasted payload out of a paste event. The clipboard is only
    // readable synchronously inside the event, so we grab both flavours up front.
    function mmReadClipboard(event) {
      var cd = event.clipboardData || window.clipboardData;
      if (!cd) return null;
      return { html: cd.getData ? cd.getData('text/html') : '', text: cd.getData('text/plain') };
    }

    // Would this payload be converted (headings / math / def-lines)? Mirrors the
    // gate in mmProcessPaste so the capture listener only takes over pastes we'd
    // actually transform, and lets ordinary prose fall through to the default.
    function mmWillConvert(html, text) {
      return (html && /<sup|<sub|<math|[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉√∑∫∞±≤≥≠×÷]/.test(html)) ||
             (text && mmLooksMathy(text));
    }

    // Core: parse a pasted payload into nodes (paragraphs / headings / image-
    // carrier math) and replace the current selection with them. Returns true
    // only when it fully handled the paste.
    function mmProcessPaste(pmView, html, text) {
      try {
        var nodesJSON = null;
        // Prefer rich HTML: it keeps <sup>/<sub>/MathML and real symbols that
        // text/plain mangles (² drops to its own line, glyphs become '?').
        if (html && /<sup|<sub|<math|[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉√∑∫∞±≤≥≠×÷]/.test(html)) {
          nodesJSON = mmParseHtml(html);
        }
        if (!nodesJSON || !nodesJSON.length) {
          if (!text || !mmLooksMathy(text)) return false; // let default paste run
          nodesJSON = mmParse(text);
        }
        if (!nodesJSON || !nodesJSON.length) return false;

        var schema = pmView.state.schema;
        var pmNodes = [];
        for (var a = 0; a < nodesJSON.length; a++) {
          try { pmNodes.push(schema.nodeFromJSON(nodesJSON[a])); }
          catch (ne) { console.error('nodeFromJSON failed:', ne.message); }
        }
        if (!pmNodes.length) return false;

        var Fragment = pmView.state.doc.content.constructor;
        var Slice = pmView.state.selection.content().constructor;
        var slice = new Slice(Fragment.fromArray(pmNodes), 0, 0);
        pmView.dispatch(pmView.state.tr.replaceSelection(slice).scrollIntoView());
        return true;
      } catch (perr) {
        console.error('math paste handler failed:', perr.message, perr.stack);
        return false; // fall back to default paste so text is never lost
      }
    }

    // ProseMirror handlePaste: convert pasted markdown-with-math into nodes so
    // formulas render as KaTeX and text is never dropped. Defined at the top
    // level (not inside initListeners) so the capture-phase listener below can
    // call it the instant this script runs. Returns true only when it fully
    // handled the paste.
    function mmHandlePaste(pmView, event) {
      var d = mmReadClipboard(event);
      if (!d) return false;
      return mmProcessPaste(pmView, d.html, d.text);
    }

    // Resolve the live ProseMirror view on demand (the editor may not be ready
    // when this script first runs; it will be by the time a paste happens).
    function mmCurrentView() {
      var pm = document.querySelector('.ProseMirror');
      return pm && pm.editor && pm.editor.view ? pm.editor.view : null;
    }

    // Capture-phase paste listener — registered the moment this script runs, so a
    // paste is handled on the FIRST attempt. Two cases:
    //   1. View already mounted → convert immediately (preventDefault so the raw
    //      plain-text paste never fires).
    //   2. View NOT mounted yet (first paste right after a cold load — tentap
    //      reports isReady a beat before it attaches .ProseMirror.editor, so
    //      the very first big paste used to land here, drop to unconverted plain
    //      text, and only the second paste worked). We grab the clipboard NOW
    //      (only readable synchronously in this event), block the raw insert, and
    //      retry the conversion once the view mounts.
    // Ordinary prose (nothing to convert) always falls through to the default.
    if (!window.__acaPasteCaptureRegistered) {
      window.__acaPasteCaptureRegistered = true;
      document.addEventListener('paste', function (event) {
        try {
          var v = mmCurrentView();
          if (v) {
            if (mmHandlePaste(v, event)) { event.preventDefault(); event.stopPropagation(); }
            return;
          }
          // View not ready yet — capture + defer so the first paste still converts.
          var d = mmReadClipboard(event);
          if (!d || (!d.text && !d.html) || !mmWillConvert(d.html, d.text)) return;
          event.preventDefault();
          event.stopPropagation();
          var tries = 0;
          (function retry() {
            var vv = mmCurrentView();
            if (vv) {
              try { mmProcessPaste(vv, d.html, d.text); }
              catch (e) { console.error('deferred paste failed:', (e && e.message) || e); }
              return;
            }
            if (tries++ < 80) setTimeout(retry, 100); // ~8s for the view to mount
          })();
        } catch (e) { console.error('capture paste failed:', (e && e.message) || e); }
      }, true);
    }

    // NodeView for an image node carrying a formula — renders KaTeX, tap to edit.
    function mathNodeView(node, view, getPos) {
      var isDisplay = node.attrs.title === 'display';
      var latex = node.attrs.alt || '';
      var dom = document.createElement('div');
      dom.className = 'katex-math-node';
      dom.setAttribute('contenteditable', 'false');
      dom.style.textAlign = isDisplay ? 'center' : 'left';
      dom.style.margin = '0.5rem 0';
      dom.style.padding = '4px 2px';
      dom.style.cursor = 'pointer';
      dom.style.overflowX = 'auto';

      // Render with throwOnError:true so a bad glyph throws instead of drawing a
      // red error; on failure retry with progressively-cleaned input: strip
      // invisible junk, then convert known Unicode math symbols to LaTeX
      // (θ→\theta, ×→\times), then strip whatever non-ASCII remains. This means a
      // stray character like the middle dot in "N·m" or a U+FFFD '?' can never
      // leave a red KaTeX error in the document.
      function renderKatex() {
        var s1 = mmSanitizeLatex(latex);
        var s2 = mmConvUnicode(s1);
        var s3 = mmStripUnknown(s2);
        var candidates = [latex, s1, s2, s3], prev = null;
        for (var ci = 0; ci < candidates.length; ci++) {
          var cand = candidates[ci];
          if (cand === prev) continue; // no change ⇒ same result, skip
          prev = cand;
          try {
            window.katex.render(cand, dom, { throwOnError: true, displayMode: isDisplay });
            return;
          } catch (e) { /* try the next, more-aggressively-cleaned candidate */ }
        }
        // Everything failed to parse — show the cleaned source without throwing
        // rather than a red error box.
        try { window.katex.render(s3, dom, { throwOnError: false, displayMode: isDisplay }); }
        catch (e2) { dom.textContent = s3; }
      }

      function render() {
        if (window.katex) {
          renderKatex();
        } else {
          dom.textContent = latex;
          var iv = setInterval(function () {
            if (window.katex) { clearInterval(iv); renderKatex(); }
          }, 100);
          setTimeout(function () { clearInterval(iv); }, 10000);
        }
      }
      render();

      dom.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (typeof getPos !== 'function') return;
        var current = node.attrs.alt || '';
        var next = prompt('Edit LaTeX formula:', current);
        if (next === null || next === current) return;
        try {
          view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, Object.assign({}, node.attrs, { alt: next })));
        } catch (err) { console.error('math edit failed:', err.message); }
      });

      return {
        dom: dom,
        update: function (updated) {
          if (updated.type.name !== node.type.name) return false;
          if (updated.attrs.src !== KATEX_SRC) return false;      // became a real image
          if ((updated.attrs.alt || '') !== latex) return false;  // recreate to re-render
          return true;
        },
        selectNode: function () { dom.style.outline = '2px solid #5d5a54'; },
        deselectNode: function () { dom.style.outline = 'none'; },
        stopEvent: function () { return true; },
        ignoreMutation: function () { return true; },
      };
    }

    function createDefaultTableJSON() {
      var rows = [];
      for (var r = 0; r < 3; r++) {
        var cells = [];
        for (var c = 0; c < 3; c++) {
          cells.push({
            type: r === 0 ? 'tableHeader' : 'tableCell',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: r === 0 ? 'Header ' + (c + 1) : '' }]
            }]
          });
        }
        rows.push({ type: 'tableRow', content: cells });
      }
      return { type: 'table', attrs: { caption: '' }, content: rows };
    }

    function tableNodeView(node, view, getPos) {
      var dom = document.createElement('div');
      dom.className = 'editor-table-wrapper';
      dom.setAttribute('contenteditable', 'false');
      dom.style.margin = '1rem 0';
      dom.style.padding = '8px';
      dom.style.border = '1px solid #e2e8f0';
      dom.style.borderRadius = '6px';
      dom.style.backgroundColor = '#f8fafc';

      var tableJSON;
      try {
        tableJSON = JSON.parse(node.attrs.alt);
      } catch (e) {
        tableJSON = createDefaultTableJSON();
      }

      // ── Toolbar ──
      var toolbar = document.createElement('div');
      toolbar.style.display = 'flex';
      toolbar.style.gap = '8px';
      toolbar.style.marginBottom = '8px';
      toolbar.style.flexWrap = 'wrap';

      function createButton(label, onClick) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.padding = '4px 8px';
        btn.style.fontSize = '12px';
        btn.style.borderRadius = '4px';
        btn.style.border = '1px solid #cbd5e1';
        btn.style.backgroundColor = '#ffffff';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          onClick();
        });
        return btn;
      }

      // Add Row Button
      toolbar.appendChild(createButton('+ Row', function() {
        if (typeof getPos !== 'function') return;
        var colsCount = tableJSON.content[0] ? tableJSON.content[0].content.length : 3;
        var newCells = [];
        for (var c = 0; c < colsCount; c++) {
          newCells.push({
            type: 'tableCell',
            content: [{ type: 'paragraph', content: [] }]
          });
        }
        tableJSON.content.push({ type: 'tableRow', content: newCells });
        updateNode();
      }));

      // Delete Row Button
      toolbar.appendChild(createButton('- Row', function() {
        if (typeof getPos !== 'function') return;
        if (tableJSON.content.length <= 1) return;
        tableJSON.content.pop();
        updateNode();
      }));

      // Add Col Button
      toolbar.appendChild(createButton('+ Col', function() {
        if (typeof getPos !== 'function') return;
        for (var r = 0; r < tableJSON.content.length; r++) {
          tableJSON.content[r].content.push({
            type: r === 0 ? 'tableHeader' : 'tableCell',
            content: [{ type: 'paragraph', content: [] }]
          });
        }
        updateNode();
      }));

      // Delete Col Button
      toolbar.appendChild(createButton('- Col', function() {
        if (typeof getPos !== 'function') return;
        var colsCount = tableJSON.content[0] ? tableJSON.content[0].content.length : 0;
        if (colsCount <= 1) return;
        for (var r = 0; r < tableJSON.content.length; r++) {
          tableJSON.content[r].content.pop();
        }
        updateNode();
      }));

      // Delete Table Button
      var delBtn = createButton('Delete Table', function() {
        if (typeof getPos !== 'function') return;
        view.dispatch(view.state.tr.delete(getPos(), getPos() + node.nodeSize));
      });
      delBtn.style.color = '#ef4444';
      delBtn.style.borderColor = '#fee2e2';
      delBtn.style.backgroundColor = '#fef2f2';
      toolbar.appendChild(delBtn);

      dom.appendChild(toolbar);

      // ── Table DOM ──
      var table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.border = '1px solid #cbd5e1';
      table.style.backgroundColor = '#ffffff';

      var rows = tableJSON.content || [];
      for (var r = 0; r < rows.length; r++) {
        var tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #cbd5e1';
        var cells = rows[r].content || [];
        for (var c = 0; c < cells.length; c++) {
          var cellNode = cells[c];
          var isHeader = cellNode.type === 'tableHeader';
          var cell = document.createElement(isHeader ? 'th' : 'td');
          cell.style.borderRight = '1px solid #cbd5e1';
          cell.style.padding = '6px';
          cell.style.backgroundColor = isHeader ? '#f1f5f9' : '#ffffff';
          cell.style.textAlign = 'left';

          var cellText = (cellNode.content || [])
            .flatMap(function(p) { return p.content || []; })
            .map(function(n) { return n.text || ''; })
            .join('');

          var input = document.createElement('div');
          input.contentEditable = 'true';
          input.textContent = cellText;
          input.style.outline = 'none';
          input.style.minHeight = '20px';
          input.style.fontSize = '12px';
          input.style.fontFamily = 'serif';

          input.addEventListener('mousedown', function(e) { e.stopPropagation(); });
          input.addEventListener('keydown', function(e) { e.stopPropagation(); });

          (function(rIdx, cIdx, inp) {
            inp.addEventListener('blur', function() {
              var text = inp.textContent || '';
              updateCell(rIdx, cIdx, text);
            });
          })(r, c, input);

          cell.appendChild(input);
          tr.appendChild(cell);
        }
        table.appendChild(tr);
      }
      dom.appendChild(table);

      // Caption Input
      var captionInput = document.createElement('input');
      captionInput.type = 'text';
      captionInput.placeholder = 'Table Caption...';
      captionInput.value = node.attrs.title || '';
      captionInput.style.width = '100%';
      captionInput.style.marginTop = '8px';
      captionInput.style.border = 'none';
      captionInput.style.borderBottom = '1px dashed #cbd5e1';
      captionInput.style.backgroundColor = 'transparent';
      captionInput.style.textAlign = 'center';
      captionInput.style.fontSize = '12px';
      captionInput.style.fontStyle = 'italic';
      captionInput.style.outline = 'none';

      captionInput.addEventListener('mousedown', function(e) { e.stopPropagation(); });
      captionInput.addEventListener('keydown', function(e) { e.stopPropagation(); });
      captionInput.addEventListener('input', function(e) {
        if (typeof getPos !== 'function') return;
        view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, Object.assign({}, node.attrs, {
          title: e.target.value
        })));
      });

      dom.appendChild(captionInput);

      function updateCell(rIndex, cIndex, newText) {
        try {
          var cell = tableJSON.content[rIndex].content[cIndex];
          cell.content = [{
            type: 'paragraph',
            content: newText ? [{ type: 'text', text: newText }] : []
          }];
          view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, Object.assign({}, node.attrs, {
            alt: JSON.stringify(tableJSON)
          })));
        } catch (e) {
          console.error('Failed to update cell:', e);
        }
      }

      function updateNode() {
        if (typeof getPos !== 'function') return;
        view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, Object.assign({}, node.attrs, {
          alt: JSON.stringify(tableJSON)
        })));
      }

      return {
        dom: dom,
        update: function (updated) {
          if (updated.type.name !== node.type.name) return false;
          if (updated.attrs.src !== TABLE_SRC) return false;
          return true;
        },
        selectNode: function () { dom.style.outline = '2px solid #5d5a54'; },
        deselectNode: function () { dom.style.outline = 'none'; },
        stopEvent: function () { return true; },
        ignoreMutation: function () { return true; },
      };
    }

    function imageNodeView(node, view, getPos) {
      // Formula carried on an image node → render as KaTeX, not a picture.
      if (node.attrs && node.attrs.src === KATEX_SRC) {
        return mathNodeView(node, view, getPos);
      }
      if (node.attrs && node.attrs.src === TABLE_SRC) {
        return tableNodeView(node, view, getPos);
      }

      
      const dom = document.createElement('div');
      dom.className = 'image-view-wrapper';

      const container = document.createElement('div');
      container.className = 'image-container';

      const img = document.createElement('img');
      img.src = node.attrs.src;
      img.alt = node.attrs.title || '';

      const captionWrap = document.createElement('div');
      captionWrap.className = 'image-caption-input-wrap';

      const input = document.createElement('input');
      input.className = 'image-caption-input';
      input.placeholder = 'Click to set figure name...';
      input.value = node.attrs.title || '';

      input.addEventListener('mousedown', (e) => e.stopPropagation());
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('keydown', (e) => e.stopPropagation());

      input.addEventListener('input', (e) => {
        if (typeof getPos !== 'function') return;
        try {
          view.dispatch(
            view.state.tr.setNodeMarkup(getPos(), undefined, Object.assign({}, node.attrs, {
              title: e.target.value,
            }))
          );
        } catch(err) {
          console.error('setNodeMarkup failed:', err);
        }
      });

      captionWrap.appendChild(input);
      container.append(img, captionWrap);
      dom.appendChild(container);

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== node.type.name) return false;
          if (img.src !== updatedNode.attrs.src) img.src = updatedNode.attrs.src;
          if (document.activeElement !== input) {
            input.value = updatedNode.attrs.title || '';
          }
          return true;
        },
        selectNode: () => dom.classList.add('selected'),
        deselectNode: () => dom.classList.remove('selected'),
        stopEvent: (event) => dom.contains(event.target),
        ignoreMutation: () => true,
      };
    }

    function initListeners() {
      const pmElem = document.querySelector('.ProseMirror');
      if (!pmElem || !pmElem.editor) {
        setTimeout(initListeners, 100);
        return;
      }

      const editor = pmElem.editor;
      const view = editor.view;
      if (!view || !editor.state || !editor.state.plugins || editor.state.plugins.length === 0) {
        setTimeout(initListeners, 100);
        return;
      }

      // 1. Monkey-patch view.setProps to persistently inject nodeViews + handlePaste
      try {
        if (!view.setProps.isMonkeyPatched) {
          const originalSetProps = view.setProps.bind(view);
          view.setProps = function(props) {
            if (props) {
              props.handlePaste = mmHandlePaste;
              if (props.nodeViews) {
                props.nodeViews = Object.assign({}, props.nodeViews, {
                  image: imageNodeView
                });
              }
            }
            return originalSetProps(props);
          };
          view.setProps.isMonkeyPatched = true;
        }

        // Initial call to register our NodeViews + paste handler
        if (!view.acaDocNodeViewsRegistered) {
          view.setProps({
            handlePaste: mmHandlePaste,
            nodeViews: Object.assign({}, view.props.nodeViews || {}, {
              image: imageNodeView
            })
          });
          view.acaDocNodeViewsRegistered = true;
        }
      } catch (err) {
        console.error('nodeViews setProps THREW:', err.message, err.stack);
      }

      // 2. Synchronously inject trailingNode plugin (with spec-based deduplication)
      try {
        const state = view.state;
        const trailingRegistered = state.plugins.some(p => p.spec && p.spec.isTrailingNode);
        
        if (!trailingRegistered) {
          const existingPlugin = state.plugins[0];
          const Plugin = existingPlugin.constructor;
          const trailingNodePlugin = new Plugin({
            isTrailingNode: true,
            appendTransaction(transactions, oldState, newState) {
              if (!transactions.some(tr => tr.docChanged)) return null;

              const lastNode = newState.doc.lastChild;
              
              if (!lastNode || lastNode.type.name === 'paragraph') {
                return null;
              }

              const type = newState.schema.nodes.paragraph;
              if (!type) return null;

              return newState.tr.insert(newState.doc.content.size, type.create());
            }
          });

          const newState = state.reconfigure({ plugins: state.plugins.concat(trailingNodePlugin) });
          view.updateState(newState);
        }
      } catch (err) {
        console.error('Failed to inject trailingNode plugin:', err);
      }

      // 3. KaTeX is injected locally from constants/katexBundle (offline, fonts
      // embedded) — streamed into the WebView in chunks before this script runs,
      // so no CDN load is needed. Re-render math nodes once the library present.
      if (!window.katexRerendered && window.katex) {
        window.katexRerendered = true;
        view.updateState(view.state);
      }
    }

    initListeners();
  })();
`;


 
