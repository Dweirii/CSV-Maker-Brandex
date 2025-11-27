# Deployment Guide

## Option 1: Vercel (Recommended for standard Next.js apps)
**Warning:** Vercel Serverless Functions have a **4.5MB request body limit**. Since this app involves uploading files (images and zips), you might hit this limit if you upload files larger than 4.5MB directly through the application.

If your files are small (<4.5MB), Vercel is the easiest option.

1.  **Push your code** to GitHub/GitLab/Bitbucket.
2.  **Import the project** in Vercel.
3.  **Configure Environment Variables**:
    Add the following variables in the Vercel Project Settings:
    *   `BUNNYCDN_API_KEY`: Your BunnyCDN API Key.
    *   `BUNNYCDN_STORAGE_ZONE`: Your Storage Zone name.
    *   `BUNNYCDN_PULL_ZONE`: Your Pull Zone URL (e.g., `https://my-zone.b-cdn.net`).
    *   `OPENAI_API_KEY`: Your OpenAI API Key.
    *   `INNGEST_EVENT_KEY`: Get this from Inngest Cloud.
    *   `INNGEST_SIGNING_KEY`: Get this from Inngest Cloud.
    *   `NEXT_PUBLIC_BRANDEX_ADMIN_API_URL`: (Optional) URL for the admin API.
    *   `NEXT_PUBLIC_STORE_ID`: (Optional) Store ID.

## Option 2: Railway (Recommended for Large File Uploads)
Railway deploys your app as a Docker container or Node.js service, which **does not have the 4.5MB body limit** (you can configure it higher). This is better for uploading large ZIPs or high-res images.

1.  **Push your code** to GitHub.
2.  **Create a new project** on Railway and select "Deploy from GitHub repo".
3.  **Configure Environment Variables** (same as above).
4.  **Build Command**: `npm run build`
5.  **Start Command**: `npm start`

## Inngest Setup (Required for both)
This app uses Inngest for background processing (bulk imports).
1.  Sign up at [Inngest Cloud](https://app.inngest.com).
2.  Create a new App.
3.  Get your `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.
4.  Add these to your deployment environment variables.
5.  Once deployed, Inngest will automatically detect your functions via the `/api/inngest` endpoint.
