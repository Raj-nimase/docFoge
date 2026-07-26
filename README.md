<div align="center">

# 🌐 docFoge Web App

### *AI-Powered Academic & Technical Document Workspace*

[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4.svg?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933.svg?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.0-000000.svg?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248.svg?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-Vision_AI-8E75B2.svg?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![LaTeX Engine](https://img.shields.io/badge/Tectonic-LaTeX_Engine-00599C.svg?style=for-the-badge)](https://tectonic-typesetting.github.org/)

<br />

**docFoge Web App** is a publication-grade document creation, editing, and compilation workspace. Combining an intuitive **Tiptap WYSIWYG editor**, **real-time KaTeX math rendering**, **Google Gemini AI vision processing**, and server-side **Tectonic LaTeX compilation**, docFoge empowers students, researchers, and engineers to create beautiful, publisher-ready PDFs effortlessly.

[Key Features](#-key-features) •
[Tech Stack](#-tech-stack) •
[Quick Start](#-quick-start) •
[Backend API Reference](#-backend-api-reference) •
[Architecture](#-project-structure)

</div>

---

## 📌 Overview

Writing complex technical documents, academic papers, and formula-heavy manuscripts in raw LaTeX often requires setting up heavy TeX distributions and wrestling with syntax errors. **docFoge Web App** bridges the gap between visual WYSIWYG editing and precise LaTeX typesetting:

- **Live Visual Editing**: Edit rich text, tables, code blocks, images, and math equations visually with immediate feedback.
- **Publisher-Grade PDF Compilation**: Compile documents into pixel-perfect PDFs using an embedded **Tectonic TeX engine** with automatic pre-warmed format caching.
- **AI-Assisted Document Processing**: Extract math formulas, scan physical documents, and convert notes directly into structured LaTeX via **Google Gemini Vision AI**.
- **Seamless Local-to-Cloud Sync**: Work offline as a guest or sign in to synchronize projects across devices with automatic guest-project migration.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| ✍️ **Visual Block Editor** | Rich document editor built on Tiptap with support for tables, underline, formatting, and images. |
| 📐 **Interactive Math & KaTeX** | Live inline and block math previewing powered by KaTeX syntax parsing. |
| ⚡ **Tectonic PDF Engine** | Server-side native compilation into publication-quality PDFs without local TeX installation. |
| 🤖 **Gemini Vision AI** | Convert scanned pages, whiteboard notes, or images directly into structured content & math equations. |
| 🖼️ **Cloudinary CDN Integration** | Instant drag-and-drop image upload backed by Cloudinary CDN storage. |
| 🎨 **Canvas & Sketch Annotation** | Interactive canvas tools using Fabric.js & Konva for visual decorations and diagrams. |
| 🧩 **Drag & Drop Reordering** | Smooth block reordering with `@hello-pangea/dnd`. |
| 🔒 **JWT Auth & Guest Mode** | Full guest mode support with zero-loss project migration upon signing up. |
| 🌍 **Multi-Language (i18n)** | Internationalization ready powered by `react-i18next`. |
| 📱 **Responsive & Mobile View** | Dedicated mobile editor view optimized for smaller touch devices (`/mobile-editor`). |

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + Vite 6
- **Styling**: Tailwind CSS 4 + Custom Overrides
- **Editor**: Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`)
- **Math Rendering**: KaTeX (`katex`), `mathml-to-latex`
- **Canvas & Graphics**: Fabric.js, Konva (`react-konva`), `html2canvas`
- **PDF Manipulation**: `pdf-lib`, `pdfjs-dist`
- **State & Routing**: Zustand 5, React Router DOM 6
- **UI & Tour**: Lucide Icons, `driver.js`, `@hello-pangea/dnd`

### Backend
- **Runtime**: Node.js (v20+) + Express 5
- **Database**: MongoDB via Mongoose ORM
- **Authentication**: JWT (`jsonwebtoken`) + `bcryptjs`
- **LaTeX Engine**: Embedded Tectonic Binary (`setup_tectonic.js`)
- **AI Service**: Google Gemini AI (`@google/generative-ai`)
- **Cloud Assets**: Cloudinary SDK (`cloudinary`), Multer
- **Imports**: Mammoth (DOCX import), `pdf-parse`

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v20 or higher
- **npm** or **yarn** or **pnpm**
- **MongoDB**: Local instance running on `mongodb://127.0.0.1:27017/acadoc` or a MongoDB Atlas URI.

---

### 1. Clone & Setup Project

```bash
git clone https://github.com/your-username/docfoge.git
cd docfoge
```

---

### 2. Configure Backend Environment

Navigate to the `backend/` directory and create `.env` based on `.env.example`:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your credentials:

```env
PORT=3001
MONGO_URI=mongodb://127.0.0.1:27017/acadoc
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Install backend dependencies (runs `node setup_tectonic.js` automatically to fetch the Tectonic binary):

```bash
npm install
```

Start backend development server:

```bash
npm run dev
```
*Backend will be running at `http://localhost:3001`*

---

### 3. Setup & Start Frontend

Open a new terminal tab and navigate to `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

*Frontend will be running at `http://localhost:5173`*

---

## 📡 Backend API Reference

### Core API Endpoints

| Category | Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- | :---: |
| **Health** | `GET` | `/api/health` | Backend status check | ❌ |
| **Auth** | `POST` | `/api/auth/register` | Register new user account | ❌ |
| **Auth** | `POST` | `/api/auth/login` | Authenticate user & receive JWT token | ❌ |
| **Auth** | `GET` | `/api/auth/me` | Fetch current user session |  |
| **Projects**| `GET` | `/api/projects` | List all projects for authenticated user |  |
| **Projects**| `POST` | `/api/projects` | Create or update user project |  |
| **Projects**| `POST` | `/api/projects/sync` | Sync & merge guest local projects into account |  |
| **Compile** | `POST` | `/api/compile` | Compile document into PDF via Tectonic engine | ❌ |
| **Vision** | `POST` | `/api/vision/analyze` | AI image-to-LaTeX / document analysis | ❌ |
| **Images** | `POST` | `/api/images/upload` | Upload image to Cloudinary CDN |  |

---

## 📂 Project Structure

```
docFoge/
├── backend/
│   ├── src/
│   │   ├── config/          # MongoDB database connection setup
│   │   ├── controllers/     # Express route handlers (auth, projects, compile, vision)
│   │   ├── middleware/      # Auth & file upload middleware
│   │   ├── models/          # Mongoose schemas (User, Project, Template)
│   │   ├── routes/          # Express API route declarations
│   │   └── services/        # Tectonic compiler & Cloudinary integrations
│   ├── server.js            # Express server initialization & keep-alive
│   ├── setup_tectonic.js    # Downloads and pre-configures Tectonic LaTeX binary
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Shared UI widgets (Toast, Modal, Spinner)
│   │   ├── contexts/        # Zustand stores (projectStore, authStore)
│   │   ├── features/        # Main modules (Auth, Dashboard, Editor, NewProject)
│   │   ├── pages/           # Page routes (Home, PdfTesterPage)
│   │   ├── services/        # API client & fetch wrappers
│   │   ├── App.jsx          # React router setup & auth bootstrap
│   │   └── main.jsx         # React DOM root entry point
│   ├── package.json
│   └── vite.config.js
└── README.md                # Project documentation
```

---

## 🧪 Testing & Verification

1. **Verify Backend Health**:
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Test PDF Compilation Engine**:
   ```bash
   curl -X POST http://localhost:3001/api/compile \
     -H "Content-Type: application/json" \
     -d '{"content": "# Hello World\nThis is a Tectonic test compile."}'
   ```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
