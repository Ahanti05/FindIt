# FindIt – AI-Powered Smart Lost & Found

> *"Lost something? Find it faster."*

A campus lost-and-found platform. Owners and finders report items with a photo;
an AI service recognises the object, turns the photo into a visual fingerprint
and matches lost reports against found ones. Both sides are notified, chat inside
the app, and the item is handed over only after ownership is verified and a
one-time handover code is confirmed.

B.Tech CSE design-thinking project – Ahanti K Kadam (4001), Maruf F Nadaf (4030), Arman R Shaikh (4033).

---

## What it does

| Step | What happens |
|---|---|
| **Report** | 4-step wizard. The photo is analysed immediately and the AI suggests the category (top 3 guesses shown). |
| **Match** | YOLOv8 localises the object, CLIP ViT-B/32 embeds it, and every new report is ranked against open reports of the other kind. |
| **Notify** | Owner **and** finder get a live Socket.IO notification for likely matches (score ≥ 0.70). |
| **Talk** | Once the owner says "this looks like mine", a private chat opens. Emails/phones are never shown. |
| **Claim** | Owner submits proof only they would know, with optional photos. Only the finder and admins can see it. |
| **Verify** | The finder or the Lost & Found office approves or declines and sets the handover place. |
| **Hand over** | The owner gets a 6-digit code + QR. The finder enters it; reports close as recovered/returned. |

Also: browse and search with filters, flag a listing, edit/archive/delete your reports, re-run AI,
profile and password change, password reset, admin dashboard (stats, AI status, claims queue,
moderation, users).

## Architecture

```
React (Vite, Tailwind)  ──REST + Socket.IO──►  Node/Express API  ──►  MongoDB
                                                    │
                                                    └─ image bytes ─►  FastAPI AI service
                                                                       YOLOv8n + CLIP ViT-B/32
```

- The **backend** owns all data. It sends image bytes to the AI service and, for
  matching, the query embedding plus candidate embeddings. The AI service never
  fetches URLs and never touches the database.
- Images are stored on **Cloudinary** if configured, otherwise in `backend/uploads/`.

### Matching score

```
combined = 0.60 × visual + 0.20 × category + 0.10 × location + 0.10 × date
```

- **visual** – CLIP cosine similarity rescaled from [0.65, 0.95] to [0, 1]
- **category** – 1 if both reports use the same category
- **location** – 1 same building, 0 different, 0.5 unknown
- **date** – Gaussian decay on the gap (σ = 5 days); a found date before the lost date scores 0

Matches ≥ 0.45 are stored and shown; ≥ 0.70 trigger notifications.

### Measured on the demo photos (`ai-service/calibrate.py`)

| | Result |
|---|---|
| Category recognition | 21 / 22 photos correct (a folded umbrella was read as clothing) |
| CLIP cosine, same object photographed twice | 0.889 – 0.978 |
| CLIP cosine, same category but a different object | 0.640 – 0.856 |
| CLIP cosine, different category | 0.307 – 0.770 |

**Limitations.** These numbers come from 22 photos, and the five "same object" pairs are
simulated re-shots (see `backend/seed/images/CREDITS.md`), so treat them as a sanity check,
not an accuracy claim. Very similar objects can still score high. In the demo data, two
*different* white chargers score 0.81 and trigger a notification. That is why matches are
only suggestions and every handover needs owner confirmation, finder/admin verification and
a handover code. YOLOv8 is trained on COCO, which has no ID card, wallet, key or charger
class, so category recognition relies on CLIP. YOLO is used only to draw boxes and to crop
when it agrees with CLIP.

---

## Run it locally

Requirements: **Node 20+**, **Python 3.10+**. MongoDB is optional (see step 2).
A GPU is used automatically if PyTorch finds one; CPU works too.

```bash
# 1. Install
cd backend  && npm install && cp .env.example .env   # then set JWT_SECRET
cd ../frontend && npm install
cd ../ai-service && python -m venv venv
venv\Scripts\activate            # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt

# 2. Database – either point MONGODB_URI at your MongoDB/Atlas, or run a local one:
cd backend && npm run db         # downloads a MongoDB binary once, keeps data in backend/.data

# 3. AI service (first start downloads YOLOv8n and CLIP weights, ~600 MB)
cd ai-service && uvicorn main:app --port 8000

# 4. API
cd backend && npm run dev

# 5. Demo data – runs every photo through the real AI pipeline
cd backend && npm run seed -- --reset

# 6. Frontend
cd frontend && npm run dev       # http://localhost:5173
```

For a single-port demo run `npm run build` in `frontend/`. The backend then serves the app
at http://localhost:5000.

### Demo accounts (`DEMO_MODE=true` shows them on the login page)

| Role | Email | Password | Story |
|---|---|---|---|
| Student | arun@university.edu | Test@1234 | Lost a wallet; claim waiting for review |
| Student | priya@university.edu | Test@1234 | Lost her ID card and headphones; both matched |
| Student | rahul@university.edu | Test@1234 | Got his backpack back (completed recovery) |
| Faculty | meera@university.edu | Test@1234 | Lost a MagSafe charger (look-alike match) |
| Staff | security@university.edu | Test@1234 | Finder for the wallet and ID card |
| Admin | admin@findit.campus | Admin@1234 | Lost & Found office |

### Tests

```bash
cd backend && npm run seed -- --reset && npm run test:e2e   # 56 checks against the running stack
cd ai-service && python calibrate.py                          # AI accuracy on the demo photos
```

The end-to-end test covers authorisation (who can read a match, claim, chat or review),
socket authentication, the full claim → approve → handover-code flow, validation errors,
moderation and password reset.

---

## API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register · login · forgot-password · reset-password/:token`, `GET /me`, `PATCH /profile · /password` |
| Items | `/api/lost-items` and `/api/found-items`: `GET /`, `GET /my`, `GET /:id`, `POST /` (multipart), `PATCH /:id`, `DELETE /:id`, `POST /:id/reprocess`, `POST /:id/flag` |
| Matches | `GET /api/matches/mine`, `GET /item/:type/:id`, `GET /:id`, `PATCH /:id/respond`, `GET·POST /:id/messages` |
| Recovery | `POST /api/recovery`, `GET /mine`, `GET /:id`, `PATCH /:id/review`, `POST /:id/complete`, `POST /:id/cancel` |
| AI | `GET /api/ai/status`, `POST /api/ai/analyze` (preview, nothing stored) |
| Admin | `GET /api/admin/stats · pending · recoveries · users`, `PATCH /moderate/:type/:id`, `PATCH /users/:id/toggle`, `POST /ai/backfill` |
| Public | `GET /api/meta`, `GET /api/stats/public`, `GET /api/health` |

AI service: `POST /analyze` (multipart image), `POST /match`, `GET /health`. Docs at http://localhost:8000/docs.

## Security notes

- JWT auth; bcrypt (12 rounds); stricter rate limit on login/register/reset.
- Socket.IO connections must present a JWT; users are placed in their own room server-side.
- Matches, chats and claims are visible only to the owner, the finder and admins.
  Finders never see the claimant's email or the handover code.
- Handover codes are compared in constant time; 5 wrong attempts lock the claim.
- `ALLOWED_EMAIL_DOMAINS` restricts sign-up to institutional email domains.
- Reports are never auto-deleted; past their expiry they are marked `expired`.
- Uploaded evidence images are served from unguessable URLs but are not
  access-controlled. Use signed Cloudinary URLs before a real deployment.

## Project structure

```
ai-service/   main.py (FastAPI) · detector.py (YOLOv8) · embedder.py (CLIP) · matcher.py · calibrate.py
backend/      server.js · src/{config,controllers,models,routes,services,utils} · seed/ · tests/e2e.js · scripts/dev-db.js
frontend/     src/{pages,components,context,services}
```
