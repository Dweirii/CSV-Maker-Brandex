# Fly.io Deployment Guide

Fly.io is an excellent choice for this application because it runs your app as a Docker container, avoiding the 4.5MB body limit of serverless functions.

## 1. Prerequisites
1.  Install the Fly CLI:
    *   **Mac (Homebrew):** `brew install flyctl`
    *   **Windows (PowerShell):** `pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"`
    *   **Linux:** `curl -L https://fly.io/install.sh | sh`
2.  Sign up or log in: `fly auth login`

## 2. Initialize App
Run the following command in your project directory:
```bash
fly launch
```
*   **Choose an app name** (or leave blank for auto-generated).
*   **Select a region** close to you (e.g., `ams`, `fra`, `lhr`, `iad`).
*   **Would you like to set up a Postgresql database now?** -> **No** (We don't need a DB for this app).
*   **Would you like to set up an Upstash Redis database now?** -> **No**.
*   **Would you like to deploy now?** -> **No** (We need to set secrets first).

This will create a `fly.toml` file.

## 3. Configure Secrets (Environment Variables)
Run the following command to set your API keys. Replace the values with your actual keys.

```bash
fly secrets set \
  BUNNYCDN_API_KEY="your_bunny_key" \
  BUNNYCDN_STORAGE_ZONE="your_storage_zone" \
  BUNNYCDN_PULL_ZONE="https://your-zone.b-cdn.net" \
  OPENAI_API_KEY="your_openai_key" \
  INNGEST_EVENT_KEY="your_inngest_event_key" \
  INNGEST_SIGNING_KEY="your_inngest_signing_key"
```

## 4. Deploy
Now you can deploy your application:
```bash
fly deploy
```

## 5. Inngest Setup
1.  Once deployed, your app will be available at `https://your-app-name.fly.dev`.
2.  Go to your [Inngest Cloud Dashboard](https://app.inngest.com).
3.  Update your App URL to match your Fly.io URL.

## Notes
*   **Memory:** If the build fails due to memory, you might need to increase the VM size. You can do this with `fly scale memory 1024`.
*   **Large Files:** We have already configured `next.config.ts` and the `Dockerfile` to handle large file uploads (up to 250MB).
