# Railway Deployment Guide (Large Files Support)

Since your files can reach **200MB**, you **cannot use Vercel** (limit is 4.5MB).
You must use a platform that supports streaming large requests, like **Railway**.

## 1. Setup Railway
1.  Go to [Railway.app](https://railway.app/) and sign up.
2.  Click **"New Project"** -> **"Deploy from GitHub repo"**.
3.  Select your repository.

## 2. Configure Environment Variables
In your Railway project dashboard, go to the **"Variables"** tab and add:

| Variable | Value |
| :--- | :--- |
| `BUNNYCDN_API_KEY` | Your BunnyCDN API Key |
| `BUNNYCDN_STORAGE_ZONE` | Your Storage Zone Name |
| `BUNNYCDN_PULL_ZONE` | Your Pull Zone URL (e.g. `https://my-zone.b-cdn.net`) |
| `OPENAI_API_KEY` | Your OpenAI API Key |
| `INNGEST_EVENT_KEY` | From Inngest Cloud |
| `INNGEST_SIGNING_KEY` | From Inngest Cloud |
| `NPM_FLAGS` | `--legacy-peer-deps` (Optional, if build fails) |

## 3. Important: Increase Timeout
Large files take time to upload.
1.  Go to **Settings** in Railway.
2.  Look for **"Deployment Defaults"** or **"Service Settings"**.
3.  Railway doesn't have a hard timeout like Vercel, but ensure your app doesn't crash.
4.  We have already configured the app to stream files, so it uses minimal memory.

## 4. Inngest Setup
1.  Once deployed, you will get a URL like `https://csv-products-maker-production.up.railway.app`.
2.  Go to your Inngest Cloud dashboard.
3.  Update your App URL to match your Railway URL.

## Troubleshooting
*   **Build Fails?** Check the logs. If it's a dependency issue, try adding `NPM_FLAGS` = `--legacy-peer-deps` variable.
*   **Uploads Stop?** If uploads cut off at exactly 1 minute, it might be a proxy timeout. Our code sets a custom timeout for the upload request, so it should be fine.
