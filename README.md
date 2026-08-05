# Thaju Yatheemkhana — Yatheem Care Portal

A real-time **sponsorship & donation management dashboard** built for Thaju Yatheemkhana. Tracks yearly Yatheem sponsorships, payment histories, C/O groups, donation slabs, and syncs data live to Firebase Firestore.

---

## ✨ Features

- 📊 **Live Dashboard** — total collected, balance remaining, payment progress
- 👤 **Donor Profiles** — full edit: name, phone, C/O, address, remarks, start date
- 💳 **Payment History** — edit & delete individual payment entries per donor
- 🗂 **C/O Group Management** — rename groups, drill into per-group analytics
- 🏷 **Donation Slabs** — configurable slabs (₹7,500 / ₹15,000 / ₹30,000 / etc.) with multi-student support
- 📅 **Date Range Filtering** — filter by preset (This Month, Last 30 Days, This Year) or custom range
- 🔍 **Live Search** — instant search with suggestions across donors, phones, and C/O groups
- 📤 **Excel Upload** — load Google Form responses directly from `.xlsx`
- ☁️ **Firebase Sync** — real-time Firestore sync for all edits
- 🌙 **Dark Mode** — sleek dark UI with glassmorphism design

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/iyasdevog/yatheem-care.git
cd yatheem-care
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Firebase

Copy the example env file and fill in your Firebase project credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values from [Firebase Console](https://console.firebase.google.com).

### 4. Run locally

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
```

---

## 🔐 Environment Variables

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firestore project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics measurement ID |

---

## 🏗 Tech Stack

- **React 18** + **TypeScript**
- **Vite** (build tool)
- **Firebase Firestore** (real-time database)
- **XLSX** (Excel file parsing)
- **Lucide React** (icons)
- **Vanilla CSS** with glassmorphism design system

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Dashboard.tsx         # Main analytics dashboard
│   ├── SlabManager.tsx       # Donation slab configuration
│   └── SponsorshipReport.tsx # Report view
├── utils/
│   ├── donationAggregator.ts # Core data aggregation engine
│   ├── excelLoader.ts        # Excel file loader
│   └── slabManager.ts        # Slab persistence utilities
├── firebase.ts               # Firebase initialization
└── App.tsx                   # Root component + state management
```

---

## 📄 License

Private — Thaju Yatheemkhana internal use.
