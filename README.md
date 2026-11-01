# FindIt – AI-Powered Smart Lost & Found Platform

> *"Lost something? Let's bring it back."*

A production-quality, full-stack web application built for campus communities. FindIt uses **YOLOv8 object detection** and **ResNet50 visual embeddings** to automatically match lost and found reports — delivering a seamless, AI-driven recovery workflow from photo upload to QR-code handover.

---

## 🖼️ Screenshots

| Landing Page | Login | Register |
|---|---|---|
| Hero + live stats | Split-panel auth | Full account form |

---

## 🏗️ Architecture Overview

```
FindIt/
├── frontend/          # React 19 + Vite 8 + Tailwind CSS v4
├── backend/           # Node.js + Express + MongoDB + Socket.IO
├── ai-service/        # Python FastAPI + YOLOv8 + ResNet50
└── docs/              # Architecture diagrams, API specs
```

### Data flow

```
User uploads image
        │
        ▼
[Express API]  →  Cloudinary (image stored)
        │
        ├─ [FastAPI /detect]  →  YOLOv8 detects objects + bounding boxes
        │
        └─ [FastAPI /embed]   →  ResNet50 generates 2048-d embedding
                                            │
                                     [FastAPI /match]
                                            │
                               Cosine similarity + category
                               + location + date score
                                            │
                               Match document saved to MongoDB
                                            │
                               Socket.IO notification → browser
```

---

## ✨ Key Features

| Feature | Details |
|---|---|
| **YOLO Object Detection** | YOLOv8n identifies objects in uploaded photos with bounding box overlays |
| **Visual Similarity Matching** | ResNet50 (2048-d) embeddings + cosine similarity with multi-signal ranking |
| **Real-Time Notifications** | Socket.IO pushes match alerts and recovery status without polling |
| **QR Recovery Codes** | Approved recovery requests generate verifiable QR codes for handover |
| **Campus Heatmap** | Admin dashboard shows where items are most commonly lost |
| **4-Step Report Wizard** | Guided lost/found reporting with drag-and-drop image upload |
| **Role-Based Access** | Student / Faculty / Staff / Admin with per-route guards |
| **Secure Claim Flow** | Claimants submit private evidence; admins verify before handover |

---

## 🛠️ Tech Stack

### Frontend
- **React 19** with Vite 8
- **Tailwind CSS v4** (`@theme` design tokens)
- **Framer Motion** – page transitions, animated score bars
- **Recharts** – admin analytics charts
- **react-dropzone** – drag-and-drop image upload
- **socket.io-client** – real-time notifications
- **react-hot-toast** – toast notifications
- **qrcode.react** – QR code display
- **date-fns** – human-friendly dates

### Backend
- **Node.js + Express 5**
- **MongoDB + Mongoose**
- **Socket.IO** – user-specific notification rooms
- **Cloudinary** – image hosting with multer-storage-cloudinary
- **JWT** + bcrypt – authentication
- **qrcode** – QR code generation
- **express-rate-limit** – API protection

### AI Service
- **FastAPI** – async Python REST API
- **YOLOv8n** (Ultralytics) – real-time object detection
- **ResNet50** (TensorFlow/Keras) – visual feature embeddings
- **NumPy** – cosine similarity computation
- **OpenCV** – bounding box annotation

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+**
- **Python 3.10+**
- **MongoDB** (local or Atlas)
- **Cloudinary account** (free tier works)

---

### 1. Clone & install

```bash
git clone https://github.com/your-username/findit.git
cd findit
```

#### Backend
```bash
cd backend
cp .env.example .env     # fill in your values
npm install
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### AI Service
```bash
cd ai-service
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

### 2. Environment Variables

**`backend/.env`**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/findit
JWT_SECRET=your_32_char_secret_here
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
AI_SERVICE_URL=http://localhost:8000
CLIENT_URL=http://localhost:5173
```

**`frontend` (Vite proxy)**  
The Vite config already proxies `/api` → `http://localhost:5000` and `/socket.io` for development.

---

### 3. Access the app

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000/api |
| AI Service | http://localhost:8000/docs |

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/forgot-password` | Send reset email |
| PATCH | `/api/auth/profile` | Update profile |

### Lost Items
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/lost-items` | Browse (filter, search, paginate) |
| POST | `/api/lost-items` | Report lost item (multipart) |
| GET | `/api/lost-items/my` | My reports |
| GET | `/api/lost-items/:id` | Detail view |
| PATCH | `/api/lost-items/:id` | Update |
| DELETE | `/api/lost-items/:id` | Delete |

### Found Items
Same structure under `/api/found-items`.

### AI / Matches
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/matches/lost/:id` | Matches for a lost item |
| GET | `/api/matches/:id` | Match detail |
| PATCH | `/api/matches/:id/respond` | Accept/reject match |

### Recovery
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/recovery` | Submit ownership claim |
| GET | `/api/recovery/:id` | Recovery status + QR |
| PATCH | `/api/recovery/:id/review` | Admin approve/deny |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | Platform analytics |
| GET | `/api/admin/pending` | Pending moderation queue |
| PATCH | `/api/admin/moderate/:type/:id` | Approve/hide item |
| GET | `/api/admin/users` | All users |
| PATCH | `/api/admin/users/:id/toggle` | Activate/deactivate user |

---

## 🤖 AI Service Endpoints

| Method | Endpoint | Input | Output |
|---|---|---|---|
| POST | `/detect` | `{ image_url }` | Detected objects, confidence, annotated image URL |
| POST | `/embed` | `{ image_url }` | 2048-d ResNet50 feature vector |
| POST | `/match` | `{ query_embedding, candidates[] }` | Ranked matches with combined score |

### Matching Algorithm

```
combined_score = (
  0.50 × visual_similarity   +   # cosine(query_embedding, candidate_embedding)
  0.20 × category_match      +   # 1.0 if same category, 0 otherwise
  0.15 × location_proximity  +   # Gaussian decay on distance
  0.15 × date_proximity          # Gaussian decay on days apart
)
```

---

## 🎨 Design System

All design tokens are defined in `frontend/src/index.css` under `@theme`:

| Token | Value | Usage |
|---|---|---|
| `--color-ink-900` | `#0d1b2a` | Primary text, headings |
| `--color-canvas` | `#f7f6f3` | Page background |
| `--color-violet-600` | `#6d5bd0` | Primary accent, CTAs |
| `--color-teal-600` | `#0d9488` | Found items, success |
| `--color-amber-500` | `#f59e0b` | Notifications, reward |
| `--font-display` | Manrope | Headings |
| `--font-sans` | Plus Jakarta Sans | Body |

---

## 📁 Project Structure

```
frontend/src/
├── components/
│   ├── Layout.jsx          # Navbar + Footer wrapper
│   ├── Navbar.jsx          # Sticky nav with notification bell
│   ├── Footer.jsx          # Dark footer
│   ├── ItemCard.jsx        # Reusable item card
│   └── NotificationDropdown.jsx
├── pages/
│   ├── LandingPage.jsx     # Hero, how-it-works, features, CTA
│   ├── LoginPage.jsx       # Split layout auth
│   ├── RegisterPage.jsx    # Full registration form
│   ├── DashboardPage.jsx   # User dashboard, tabs, real-time
│   ├── BrowsePage.jsx      # Filter, search, paginate all items
│   ├── ItemDetailPage.jsx  # Item detail + AI results + matches
│   ├── ReportLostPage.jsx  # 4-step wizard
│   ├── ReportFoundPage.jsx # 4-step wizard
│   ├── MatchDetailPage.jsx # Match comparison + claim form
│   ├── RecoveryPage.jsx    # Recovery status + QR code
│   ├── AdminDashboard.jsx  # Stats, moderation, user management
│   └── ProfilePage.jsx
├── context/
│   ├── AuthContext.jsx     # JWT auth state
│   └── SocketContext.jsx   # Socket.IO connection
├── services/
│   └── api.js              # Axios client with interceptors
└── index.css               # Design system + component classes

backend/src/
├── models/                 # Mongoose schemas
├── controllers/            # Business logic
├── routes/                 # Express routers
├── middleware/             # Auth, error handling
└── config/                 # DB, Cloudinary

ai-service/
├── main.py                 # FastAPI app
├── detector.py             # YOLOv8 detection
├── embedder.py             # ResNet50 embeddings
└── matcher.py              # Cosine similarity + ranking
```

---

## 🔐 Security

- JWT tokens stored in `localStorage`, sent via `Authorization: Bearer` header
- Rate limiting on all auth endpoints (`express-rate-limit`)
- Passwords hashed with bcrypt (salt rounds = 12)
- Ownership evidence for recovery claims is never publicly visible
- Admin-only routes protected server-side with role check
- Cloudinary signed uploads with pre-set allowed formats

---

## 🚧 Roadmap

- [ ] Email notifications via SendGrid / Nodemailer
- [ ] Campus map integration (Leaflet.js) with item pinning
- [ ] Multi-image upload (up to 4 photos per report)
- [ ] Mobile app (React Native)
- [ ] AI auto-category suggestion pre-submit
- [ ] WhatsApp / Telegram bot integration

---

## 📄 License

MIT © 2024 FindIt. Built for campus communities.
