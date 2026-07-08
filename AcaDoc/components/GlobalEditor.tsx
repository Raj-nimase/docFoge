import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { RichText, useEditorBridge, TenTapStartKit } from '@10play/tentap-editor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalEditorStore } from '@/stores/editorStore';
import { C } from '@/constants/theme';
import { useProjectStore } from '@/stores/projectStore';

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

  useEffect(() => {
    setBridge(editor);
    return () => setBridge(null);
  }, [editor, setBridge]);

  useEffect(() => {
    if (!editor || !activeChapterId) return;
    
    // Inject styles and scripts when switching chapters (guarantees editor is active and Tiptap is loaded)
    const timer = setTimeout(() => {
      console.log('Active chapter changed to:', activeChapterId, '- Injecting CSS and JS NodeView');
      editor.injectCSS(academicCSS, 'academic-theme');
      editor.injectJS(imageCaptionJS);
    }, 400);

    return () => clearTimeout(timer);
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

    if (window.acaDocImageNodeViewInitialized) return;
    window.acaDocImageNodeViewInitialized = true;

    function imageNodeView(node, view, getPos) {
      console.log('imageNodeView mounted', node.attrs.src);
      
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
          console.log('setNodeMarkup succeeded', e.target.value);
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

      // 1. Register the image NodeView (merged to preserve other nodeViews like tables/math)
      view.setProps({
        nodeViews: Object.assign({}, view.props.nodeViews, {
          image: imageNodeView
        })
      });

      // 2. Synchronously inject trailingNode plugin (with spec-based deduplication)
      try {
        const state = view.state;
        const alreadyRegistered = state.plugins.some(p => p.spec && p.spec.isTrailingNode);
        
        if (!alreadyRegistered) {
          const existingPlugin = state.plugins[0];
          const Plugin = existingPlugin.constructor;
          const trailingNodePlugin = new Plugin({
            isTrailingNode: true,
            appendTransaction(transactions, oldState, newState) {
              if (!transactions.some(tr => tr.docChanged)) return null;

              const lastNode = newState.doc.lastChild;
              console.log('trailing check', lastNode ? lastNode.type.name : 'none');
              
              if (!lastNode || lastNode.type.name === 'paragraph') {
                return null;
              }

              const type = newState.schema.nodes.paragraph;
              if (!type) return null;

              return newState.tr.insert(newState.doc.content.size, type.create());
            }
          });

          const newState = state.reconfigure({ plugins: state.plugins.concat(trailingNodePlugin) });
          console.log('reconfigure firing, doc size:', state.doc.content.size, 'selection:', state.selection.from);
          view.updateState(newState);
          console.log('trailingNode plugin registered successfully');
        } else {
          // Force a state update to bind nodeViews immediately using the fresh state
          view.updateState(state);
        }
      } catch (err) {
        console.error('Failed to reconfigure ProseMirror plugins:', err);
        view.updateState(view.state);
      }
    }
    
    initListeners();
  })();
`;


