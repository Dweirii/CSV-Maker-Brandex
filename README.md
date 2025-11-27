# CSV Products Maker

This is a specialized tool built for the Brandex ecosystem to streamline the process of importing large product catalogs. It solves a specific problem: taking hundreds of large design files (images and ZIPs), uploading them to a CDN, and generating a structured CSV file that can be imported into the Brandex Admin dashboard.

## What it does

The application provides a simple interface where you can drag and drop hundreds of files at once. It automatically pairs them up based on their filenames (e.g., "design-01.jpg" matches with "design-01.zip").

Once paired, it handles the heavy lifting:
1.  **Validation**: Checks if every image has a corresponding download file and warns you about any orphans.
2.  **Upload**: Streams files directly to BunnyCDN. It is optimized for large files (up to 250MB each) and handles them in parallel to maximize speed without crashing the browser.
3.  **Processing**: Uses OpenAI to generate smart metadata (titles, descriptions, tags) based on the filenames.
4.  **Export**: Produces a clean, formatted CSV file ready for import.

## Technology Stack

-   **Framework**: Next.js 15 (App Router)
-   **Styling**: Tailwind CSS
-   **Queue System**: Inngest (for background processing)
-   **Storage**: BunnyCDN
-   **AI**: OpenAI (for metadata generation)

## Getting Started

### Prerequisites

You will need Node.js installed (version 18 or higher recommended).

### Environment Variables

Create a .env.local file in the root directory with the following keys:

BUNNYCDN_API_KEY=your_key
BUNNYCDN_STORAGE_ZONE=your_zone_name
BUNNYCDN_PULL_ZONE=https://your-zone.b-cdn.net
OPENAI_API_KEY=your_openai_key
INNGEST_EVENT_KEY=your_inngest_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

### Running Locally

1.  Install dependencies:
    npm install

2.  Start the Inngest dev server (required for background jobs):
    npx inngest-cli dev

3.  In a separate terminal, start the Next.js app:
    npm run dev

The application will be available at http://localhost:3000.

## Deployment

This application is designed to handle large file uploads, which requires a specific hosting setup. Standard serverless platforms like Vercel have a 4.5MB upload limit, which is too small for this use case.

We recommend deploying to a platform that supports Docker containers or long-running Node.js processes.

-   **Fly.io**: Recommended. See FLY_IO_GUIDE.md for detailed instructions.
-   **Railway**: Alternative option. See RAILWAY_GUIDE.md for instructions.

## Configuration

If you need to adjust upload limits or timeouts, check the following files:

-   **next.config.ts**: Controls the body size limit (currently set to 250MB).
-   **app/api/upload/route.ts**: Controls the server-side timeout (currently set to 15 minutes per file).
-   **lib/bunnycdn.ts**: Controls the CDN upload timeout (currently set to 2 hours).
