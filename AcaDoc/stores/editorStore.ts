import { create } from 'zustand';

interface EditorFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EditorState {
  bridge: any | null; // TipTap bridge instance
  visible: boolean;
  frame: EditorFrame;
  onChangeCallback: (() => void) | null;
  onBlurCallback: (() => void) | null;
  isDropdownOpen: boolean;
  isDrawerOpen: boolean;
  onAddChapterCallback: (() => void) | null;
  onRenameChapterCallback: ((chapter: any) => void) | null;

  setBridge: (bridge: any) => void;
  setVisible: (visible: boolean) => void;
  setFrame: (frame: EditorFrame) => void;
  setOnChangeCallback: (cb: (() => void) | null) => void;
  setOnBlurCallback: (cb: (() => void) | null) => void;
  setDropdownOpen: (isOpen: boolean) => void;
  setDrawerOpen: (isOpen: boolean) => void;
  setOnAddChapterCallback: (cb: (() => void) | null) => void;
  setOnRenameChapterCallback: (cb: ((chapter: any) => void) | null) => void;
}

export const useGlobalEditorStore = create<EditorState>((set) => ({
  bridge: null,
  visible: false,
  frame: { x: 0, y: 0, width: 0, height: 0 },
  onChangeCallback: null,
  onBlurCallback: null,
  isDropdownOpen: false,
  isDrawerOpen: false,
  onAddChapterCallback: null,
  onRenameChapterCallback: null,

  setBridge: (bridge) => set({ bridge }),
  setVisible: (visible) => set({ visible }),
  setFrame: (frame) => set({ frame }),
  setOnChangeCallback: (onChangeCallback) => set({ onChangeCallback }),
  setOnBlurCallback: (onBlurCallback) => set({ onBlurCallback }),
  setDropdownOpen: (isDropdownOpen) => set({ isDropdownOpen }),
  setDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
  setOnAddChapterCallback: (onAddChapterCallback) => set({ onAddChapterCallback }),
  setOnRenameChapterCallback: (onRenameChapterCallback) => set({ onRenameChapterCallback }),
}));
