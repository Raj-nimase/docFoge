# 🎨 docFoge Web App - Frontend

[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

This directory contains the client-side single-page web application for **docFoge**, built with **React 19**, **Vite 6**, **Tiptap**, **KaTeX**, and **Tailwind CSS 4**.

> 📖 **For complete application documentation, full-stack setup, and backend API specs, refer to the [Root README](../README.md).**

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Vite Dev Server
```bash
npm run dev
```

The application will be accessible at [http://localhost:5173](http://localhost:5173).

---

## 🛠️ Key Libraries & Technologies

- **Editor Engine**: Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`)
- **Math Formatting**: KaTeX (`katex`), `mathml-to-latex`
- **Canvas & Drawing**: Fabric.js, Konva (`react-konva`), `html2canvas`
- **PDF Manipulation**: `pdf-lib`, `pdfjs-dist`
- **State Management**: Zustand (`useAcaStore`, `useAuthStore`)
- **Routing**: React Router DOM (`react-router-dom`)
- **Drag & Drop**: `@hello-pangea/dnd`
- **Internationalization**: `react-i18next`, `i18next`

---

## 📜 Scripts

- `npm run dev`: Launch local Vite development server with HMR.
- `npm run build`: Build production assets into the `dist/` directory.
- `npm run preview`: Preview the production bundle locally.
- `npm run lint`: Run ESLint checks across the codebase.
