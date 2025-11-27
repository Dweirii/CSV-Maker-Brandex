# 🚀 Google Drive Integration - Quick Start

## ⏱️ 5-Minute Setup

### Step 1: Add Environment Variable
Add this to `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_API_KEY=your_api_key_here
```

**Get it here:** [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
- Click "+ CREATE CREDENTIALS" > "API Key"
- Copy the key
- Restrict to: Google Drive API & Picker API
- Add referrer: `http://localhost:3000/*`

### Step 2: Update OAuth Settings
Go to: [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)

**Edit your OAuth 2.0 Client ID:**

✅ **Authorized JavaScript origins:**
```
http://localhost:3000
```

✅ **Authorized redirect URIs:**
```
http://localhost:3000/api/auth/google/callback
```

### Step 3: Restart Dev Server
```bash
pnpm dev
```

### Step 4: Test It!
1. Visit http://localhost:3000
2. Click **"Connect to Google Drive"**
3. Approve permissions
4. Click **"Select from Google Drive"**
5. Select files → They automatically pair! ✨

---

## 📁 What Was Built

| File | Purpose |
|------|---------|
| `lib/google/auth.ts` | OAuth & token management |
| `lib/google/picker.ts` | Picker SDK wrapper |
| `app/api/auth/google/route.ts` | OAuth initiation |
| `app/api/auth/google/callback/route.ts` | OAuth callback |
| `app/api/google/download/route.ts` | File downloads |
| `components/GoogleDrivePicker.tsx` | UI component |
| `components/file-upload.tsx` | Integration point |

---

## ✅ Production Checklist

### For Fly.io Deployment:

```bash
# Set secrets
fly secrets set GOOGLE_CLIENT_ID="your_id.apps.googleusercontent.com"
fly secrets set GOOGLE_CLIENT_SECRET="your_secret"
fly secrets set GOOGLE_REDIRECT_URI="https://yourdomain.com/api/auth/google/callback"
fly secrets set NEXT_PUBLIC_GOOGLE_API_KEY="your_key"

# Deploy
fly deploy
```

### Update Google Console for Production:

Add to **Authorized JavaScript origins:**
```
https://yourdomain.com
```

Add to **Authorized redirect URIs:**
```
https://yourdomain.com/api/auth/google/callback
```

Update **API Key restrictions:**
- Add production domain to HTTP referrers

---

## 🎯 How It Works

```
User clicks "Select from Google Drive"
        ↓
Google Picker opens with file selection
        ↓
User selects files (images + PDFs/ZIPs)
        ↓
Files download from Drive via API
        ↓
Convert to File[] objects
        ↓
Feed into existing pairFiles() logic ✅
        ↓
Everything else is IDENTICAL!
(BunnyCDN upload → Inngest → CSV)
```

---

## 🔒 Security

✅ Tokens in HTTP-only cookies (not accessible via JS)  
✅ Read-only Drive scope  
✅ Automatic token refresh  
✅ HTTPS in production  
✅ API key restrictions  

---

## 🐛 Troubleshooting

### "redirect_uri_mismatch"
→ Check Google Console redirect URIs match `.env.local` EXACTLY

### "Picker fails to load"
→ Make sure `NEXT_PUBLIC_GOOGLE_API_KEY` is set (note the prefix!)  
→ Check Picker API is enabled in Google Console

### "Not authenticated"
→ Click "Connect to Google Drive" first  
→ Check cookies aren't blocked

### "Download failed"
→ Make sure Drive API is enabled  
→ File must be owned by or shared with authenticated user

---

## 📖 Full Documentation

- **Setup Guide**: `GOOGLE_DRIVE_SETUP.md`
- **Implementation Details**: `GOOGLE_DRIVE_IMPLEMENTATION.md`

---

## 💡 Features

✨ Multi-select up to 200 files  
✨ File type filtering (images, PDFs, ZIPs)  
✨ Uses same pairing logic as local uploads  
✨ Automatic error recovery  
✨ Progress feedback  
✨ Token auto-refresh  

---

Built with ❤️ • Production Ready ✅ • Zero Breaking Changes 🎉
