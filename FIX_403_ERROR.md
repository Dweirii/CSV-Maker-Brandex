# 🔧 Fixed: Google Picker 403 Error

## What Went Wrong

The Google Picker was getting a **403 Forbidden** error because:

1. **Origin Mismatch**: Browser was accessing from `http://127.0.0.1:3000` but Google Console only had `http://localhost:3000` configured
2. **Missing Access Token**: The Picker needs a real OAuth access token, not just an API key

## What Was Fixed

### 1. Created `/api/google/token` endpoint
- Safely provides the access token from HTTP-only cookies
- Automatically refreshes expired tokens
- Updates cookies if token was refreshed

### 2. Updated `GoogleDrivePicker.tsx`
- Now fetches real access token before opening picker
- Passes actual OAuth token to Picker API
- Better error handling

## 🛠️ What You Need to Do Now

### Step 1: Update Google Cloud Console

Go to: [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)

#### Edit your OAuth 2.0 Client:

**Add BOTH origins to "Authorized JavaScript origins":**
```
http://localhost:3000
http://127.0.0.1:3000
```

**Add BOTH URIs to "Authorized redirect URIs":**
```
http://localhost:3000/api/auth/google/callback
http://127.0.0.1:3000/api/auth/google/callback
```

#### Edit your API Key:

Under "Application restrictions" > "HTTP referrers", add:
```
http://localhost:3000/*
http://127.0.0.1:3000/*
```

### Step 2: Update Your `.env.local`

Make sure you have this variable (you might need to add it):

```bash
# Existing (you already have these)
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Add this if missing
NEXT_PUBLIC_GOOGLE_API_KEY=your_api_key_here
```

### Step 3: Reconnect to Google Drive

Since we updated the authentication flow:

1. Open http://localhost:3000 (or 127.0.0.1:3000)
2. The page should auto-reload (dev server detected changes)
3. Click "**Connect to Google Drive**" again
4. Approve permissions
5. Now try "**Select from Google Drive**"

It should work! 🎉

## 🧪 Testing

After updating Google Console and reconnecting:

1. Open browser DevTools > Console
2. Click "Select from Google Drive"
3. You should see:
   ```
   [GoogleDrivePicker] Opening picker with valid token
   ```
4. Google Picker modal should appear
5. Select files → Success!

## 🐛 If Still Not Working

### Check Console Logs

Look for these messages:
- ✅ `[GoogleDrivePicker] Opening picker with valid token`
- ✅ `[Google Picker] API loaded successfully`
- ❌ If you see 403 errors, double-check Google Console origins

### Verify Environment Variable

In browser console, type:
```javascript
console.log(process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
```

Should show your API key (not undefined).

### Clear Cookies and Reconnect

1. Open DevTools > Application > Cookies
2. Delete all cookies for localhost:3000
3. Refresh page
4. Click "Connect to Google Drive" again

### Check Google Console

Make sure:
- ✅ Google Drive API is **enabled**
- ✅ Google Picker API is **enabled**
- ✅ Both `localhost` and `127.0.0.1` are in authorized origins
- ✅ API key allows both referrers

## 📝 What Changed in Code

### New File Created:
- `app/api/google/token/route.ts` - Provides access token to frontend

### Modified Files:
- `components/GoogleDrivePicker.tsx` - Now uses real token

### Why This Fix Works:

Before:
```typescript
createPicker('dummy_token', apiKey, ...) // ❌ 403 Error
```

After:
```typescript
const { accessToken } = await fetch('/api/google/token')
createPicker(accessToken, apiKey, ...) // ✅ Works!
```

The Picker API requires **both** an API key AND a valid OAuth access token. We were only providing the API key before.

## 🎯 Expected Behavior After Fix

1. ✅ Click "Select from Google Drive"
2. ✅ Brief "Getting access token..." toast
3. ✅ Google Picker modal opens
4. ✅ Shows your Drive files
5. ✅ Select files → Download → Pair → Upload to BunnyCDN

## 💡 Pro Tips

### Use localhost, not 127.0.0.1

For consistency, always access via:
```
http://localhost:3000
```

This way you only need one set of origins in Google Console.

### Monitor Token Refresh

Check server logs for:
```
[Google Auth] Access token expired, refreshing...
[Google Token] Token was refreshed, updating cookies
```

This shows automatic token refresh is working.

---

**Once you update Google Console and reconnect, everything should work perfectly!** 🚀
