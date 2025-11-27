# Google Drive Integration Setup Guide

## 📋 Prerequisites

You've already set up the basic OAuth credentials. Now you need to add one more environment variable for the Picker API.

## 🔐 Environment Variables

Add this to your `.env.local` file:

```bash
# Existing (you already have these)
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# NEW - Add this for the Picker API
NEXT_PUBLIC_GOOGLE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
```

### How to Get the API Key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **API Key**
5. Copy the generated key
6. **Important**: Click "Edit API Key" and:
   - Under "API restrictions", select "Restrict key"
   - Enable only: **Google Drive API** and **Google Picker API**
   - Under "Application restrictions", select "HTTP referrers"
   - Add: `http://localhost:3000/*` and your production domain

## 🔧 Google Cloud Console Configuration

### 1. Enable Required APIs

Make sure these APIs are enabled in your project:

```
✓ Google Drive API
✓ Google Picker API
```

Go to **APIs & Services** > **Library** and search for each API to enable it.

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace)
3. Fill in:
   - **App name**: Your app name (e.g., "CSV Products Maker")
   - **User support email**: Your email
   - **Developer contact**: Your email
4. **Scopes**: Add the following scope:
   - `https://www.googleapis.com/auth/drive.readonly`
5. **Test users** (if in testing mode): Add your Gmail address
6. Save and continue

### 3. Configure OAuth 2.0 Client ID

1. Go to **APIs & Services** > **Credentials**
2. Find your OAuth 2.0 Client ID (the one you created)
3. Click the edit icon (pencil)
4. Add **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   https://yourdomain.com (when deploying)
   ```
5. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/google/callback
   https://yourdomain.com/api/auth/google/callback (when deploying)
   ```
6. Click **Save**

## 🚀 Testing Locally

1. Make sure your `.env.local` has all 4 variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `NEXT_PUBLIC_GOOGLE_API_KEY`

2. Restart your dev server:
   ```bash
   pnpm dev
   ```

3. Go to http://localhost:3000

4. You should see:
   - The normal file upload dropzone
   - A divider with "OR"
   - A "Connect to Google Drive" button

5. Click "Connect to Google Drive":
   - You'll be redirected to Google
   - Approve the permissions
   - You'll be redirected back to your app
   - Button will change to "Select from Google Drive"

6. Click "Select from Google Drive":
   - Google Picker modal opens
   - Select files (images + PDFs/ZIPs)
   - Files are downloaded and processed
   - Same pairing logic as local uploads

## 🌐 Production Deployment

### Environment Variables on Fly.io

Set the environment variables on Fly.io:

```bash
fly secrets set GOOGLE_CLIENT_ID="xxxxxxxxxxxxx.apps.googleusercontent.com"
fly secrets set GOOGLE_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxx"
fly secrets set GOOGLE_REDIRECT_URI="https://yourdomain.com/api/auth/google/callback"
fly secrets set NEXT_PUBLIC_GOOGLE_API_KEY="xxxxxxxxxxxxxxxxxxxxxxxx"
```

### Update Google Cloud Console

1. Add your production domain to:
   - Authorized JavaScript origins
   - Authorized redirect URIs
2. Update API key restrictions to include your production domain
3. If your app is in "Testing" mode, publish it or add users to test users list

## 🔒 Security Checklist

✅ Access tokens stored in HTTP-only cookies (not accessible via JavaScript)  
✅ Only `drive.readonly` scope (can't modify user's files)  
✅ API key restricted to specific APIs  
✅ API key restricted to specific domains  
✅ HTTPS enforced in production  
✅ CSRF protection via SameSite cookies

## 🐛 Troubleshooting

### "Missing required environment variables"
- Make sure all 4 environment variables are set
- Restart dev server after adding variables

### "OAuth error: redirect_uri_mismatch"
- Check that redirect URI in `.env.local` EXACTLY matches Google Console
- Make sure there's no trailing slash difference
- Make sure protocol matches (http vs https)

### "Google Picker fails to load"
- Check browser console for errors
- Make sure `NEXT_PUBLIC_GOOGLE_API_KEY` is set (note the NEXT_PUBLIC prefix)
- Make sure Picker API is enabled in Google Console

### "Failed to download files from Google Drive"
- Check that Drive API is enabled
- Check that access token is valid (try disconnecting and reconnecting)
- Check file permissions (files must be owned by or shared with the authenticated user)

### "Quota exceeded"
- Google Drive API has a free quota of 10,000 requests/day
- Each file download = 1 request
- Monitor usage in Google Cloud Console > APIs & Services > Dashboard
- Request quota increase if needed (usually approved quickly)

## 📊 API Quotas

**Free Tier Limits:**
- 10,000 requests per day
- 100 requests per 100 seconds per user

**What counts as a request:**
- Each file download = 1 request
- Token refresh = 1 request

**Monitoring:**
- Check usage: Google Cloud Console > APIs & Services > Dashboard
- Set up quota alerts to be notified before hitting limits

## 🎯 User Flow

1. **First time:**
   - User clicks "Connect to Google Drive"
   - Redirected to Google OAuth
   - Grants permissions
   - Redirected back (token stored in cookie)
   - Button changes to "Select from Google Drive"

2. **Subsequent uses:**
   - User clicks "Select from Google Drive"
   - Picker opens immediately (no re-auth needed)
   - Selects files
   - Files downloaded and processed same as local uploads

3. **Token expiry:**
   - Tokens automatically refresh when expired
   - User only needs to re-authenticate if refresh fails (rare)

## 📝 Notes

- Tokens are stored for 7 days
- After 7 days, users need to reconnect
- Local file upload continues to work independently
- Both methods use the same file pairing and processing logic
- Google Drive files are downloaded to browser, then uploaded to BunnyCDN (not stored on your server)
