# ⚙️ docFoge Web App - Backend

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933.svg?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.0-000000.svg?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-Vision_AI-8E75B2.svg?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![LaTeX Engine](https://img.shields.io/badge/Tectonic-LaTeX_Engine-00599C.svg)](https://tectonic-typesetting.github.org/)

This directory contains the REST API server for **docFoge**, built with **Node.js**, **Express 5**, **MongoDB**, **Tectonic LaTeX Engine**, and **Google Gemini Vision AI**.

> 📖 **For full-stack architecture, environment setup, and root project details, refer to the [Root README](../README.md).**

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```
*Note: Installing dependencies automatically runs `node setup_tectonic.js` to download and configure the standalone Tectonic LaTeX engine binary.*

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

Key environment variables:
```env
PORT=3001
MONGO_URI=mongodb://127.0.0.1:27017/acadoc
JWT_SECRET=your-secret-key
GEMINI_API_KEY=your-gemini-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 3. Start Development Server
```bash
npm run dev
```

The server will start on [http://localhost:3001](http://localhost:3001).

---

## 📡 API Overview

- `GET /api/health` - Health check endpoint
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication & JWT issuance
- `GET /api/projects` - List user projects
- `POST /api/compile` - Tectonic PDF compilation engine
- `POST /api/vision/analyze` - Gemini Vision document & formula extraction
- `POST /api/images/upload` - Cloudinary CDN image upload
