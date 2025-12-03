# CSV Products Maker - Technical Architecture Diagram

## System Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE LAYER                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │  File Upload     │  │ Category Selector│  │  Progress/Status │     │
│  │  Component       │  │  Component       │  │  Component       │     │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘     │
│           │                     │                     │               │
│           └─────────────────────┴─────────────────────┘               │
│                              │                                        │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT-SIDE PROCESSING                            │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  File Pairing Logic                                          │      │
│  │  • Extract base names from filenames                        │      │
│  │  • Match image + download files (or single files)            │      │
│  │  • Validate file types and pairs                             │      │
│  │  • Group by category requirements                            │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FILE UPLOAD PHASE                                │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Concurrent Upload Manager                                   │      │
│  │  • Concurrency: 8-25 (based on file type)                   │      │
│  │  • Retry Logic: 2 retries with exponential backoff          │      │
│  │  • Progress Tracking: 5% → 50%                              │      │
│  └──────────────────────┬───────────────────────────────────────┘      │
│                         │                                               │
│                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Upload API Endpoint                                         │      │
│  │  • Accepts file streams                                      │      │
│  │  • Validates file types                                      │      │
│  │  • Routes to storage service                                 │      │
│  └──────────────────────┬───────────────────────────────────────┘      │
│                         │                                               │
│                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  BunnyCDN Storage Service                                    │      │
│  │  • Stores images in /images/ folder                          │      │
│  │  • Stores downloads in /downloads/ folder                    │      │
│  │  • Returns CDN URLs                                          │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      JOB INITIATION PHASE                               │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Import API Endpoint                                         │      │
│  │  • Generates unique Job ID                                   │      │
│  │  • Validates category and file pairs                         │      │
│  │  • Creates background job event                               │      │
│  └──────────────────────┬───────────────────────────────────────┘      │
│                         │                                               │
│                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Inngest Event System                                        │      │
│  │  • Receives "bulk.import" event                              │      │
│  │  • Queues job for background processing                       │      │
│  │  • Returns Job ID to client                                  │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND PROCESSING (Inngest)                      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Step 1: Validate URLs                                       │      │
│  │  • Verify all file URLs are accessible                       │      │
│  │  • Check URL format and structure                            │      │
│  └──────────────────────┬───────────────────────────────────────┘      │
│                         │                                               │
│                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Step 2: Generate Metadata (Concurrency: 20)                │      │
│  │  ┌────────────────────────────────────────────────────┐     │      │
│  │  │  For each product:                                 │     │      │
│  │  │  ┌──────────────────────────────────────────┐    │     │      │
│  │  │  │  OpenAI GPT-4o-mini API                   │    │     │      │
│  │  │  │  • Input: Image URL, filename, category   │    │     │      │
│  │  │  │  • Output: Name, description, keywords    │    │     │      │
│  │  │  └──────────────────────────────────────────┘    │     │      │
│  │  │  • Fallback: Generate from filename if fails     │     │      │
│  │  └────────────────────────────────────────────────────┘     │      │
│  └──────────────────────┬───────────────────────────────────────┘      │
│                         │                                               │
│                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Step 3: Generate CSV                                        │      │
│  │  • Transform products to CSV format                          │      │
│  │  • Match Brandex-Admin schema                                │      │
│  │  • Include metadata, URLs, status, errors                    │      │
│  └──────────────────────┬───────────────────────────────────────┘      │
│                         │                                               │
│                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Step 4: Store Results                                       │      │
│  │  • Save to in-memory job store                               │      │
│  │  • Send webhook notification                                  │      │
│  │  • Update job status: completed                              │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT POLLING PHASE                              │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Status API Endpoint                                         │      │
│  │  • GET /api/import/[jobId]                                   │      │
│  │  • Returns: status, CSV content, success/failure counts      │      │
│  └──────────────────────┬───────────────────────────────────────┘      │
│                         │                                               │
│                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Polling Logic (Frontend)                                    │      │
│  │  • Polls every 5 seconds                                     │      │
│  │  • Max 120 attempts (10 minutes)                             │      │
│  │  • Updates progress: 50% → 90%                                │      │
│  │  • Shows completion when ready                               │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          CSV DOWNLOAD                                    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Download Handler                                            │      │
│  │  • Creates Blob from CSV content                            │      │
│  │  • Triggers browser download                                │      │
│  │  • Filename: products-{timestamp}.csv                       │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘

```

## Data Flow Diagram

```
┌─────────────┐
│   User      │
│  Uploads    │
│   Files     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend Application                                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  1. File Pairing & Validation                         │ │
│  │     Input: Raw Files                                  │ │
│  │     Output: Validated File Pairs                      │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  2. Upload to CDN (Concurrent)                       │ │
│  │     Input: File Pairs                                 │ │
│  │     Output: File Pairs with CDN URLs                  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  3. Initiate Background Job                          │ │
│  │     Input: File Pairs + URLs, Category               │ │
│  │     Output: Job ID                                    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  4. Poll for Results                                  │ │
│  │     Input: Job ID                                     │ │
│  │     Output: Job Status + CSV Content                  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       │ (Job Event)
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Inngest Background Processing                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Step 1: Validate URLs                                │ │
│  │    Input: File URLs                                   │ │
│  │    Output: Validated URLs                             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Step 2: Generate Metadata (Parallel)                 │ │
│  │    Input: Image URLs, Filenames, Category             │ │
│  │    ┌───────────────────────────────────────────────┐  │ │
│  │    │  OpenAI API Call (20 concurrent)              │  │ │
│  │    │  • Analyze image                              │  │ │
│  │    │  • Generate name, description, keywords       │  │ │
│  │    └───────────────────────────────────────────────┘  │ │
│  │    Output: Product Metadata                          │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Step 3: Generate CSV                                 │ │
│  │    Input: Product Metadata + URLs                    │ │
│  │    Output: CSV String (Brandex-Admin format)         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Step 4: Store & Notify                              │ │
│  │    Input: CSV + Results                              │ │
│  │    Output: Stored in Job Store + Webhook              │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       │ (Polling)
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Job Store (In-Memory)                                      │
│  • Status: processing → completed                           │
│  • CSV Content                                              │
│  • Success/Failure Counts                                   │
└─────────────────────────────────────────────────────────────┘
       │
       │ (Download)
       ▼
┌─────────────┐
│   User      │
│ Downloads   │
│   CSV       │
└─────────────┘
```

## Component Interaction Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                             │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  BunnyCDN    │  │   OpenAI     │  │   Inngest    │              │
│  │  Storage     │  │   GPT-4o     │  │   Cloud      │              │
│  │              │  │              │  │              │              │
│  │ • File Store │  │ • Metadata  │  │ • Job Queue  │              │
│  │ • CDN URLs   │  │ • Generation│  │ • Processing │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
         │                    │                    │
┌────────┴────────────────────┴────────────────────┴──────────────┐
│                    NEXT.JS APPLICATION                           │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  CLIENT COMPONENTS (React)                                │  │
│  │  • File Upload UI                                         │  │
│  │  • Category Selector                                      │  │
│  │  • Progress Tracker                                       │  │
│  │  • Status Display                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                           ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  CLIENT-SIDE LOGIC                                        │  │
│  │  • File Pairing Algorithm                                 │  │
│  │  • Concurrent Upload Manager                              │  │
│  │  • Retry Logic                                            │  │
│  │  • Polling Logic                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                           ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  API ROUTES (Server)                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │  Upload API  │  │  Import API  │  │  Status API  │   │  │
│  │  │              │  │              │  │              │   │  │
│  │  │ • Stream     │  │ • Create Job │  │ • Get Status │   │  │
│  │  │ • Validate   │  │ • Send Event │  │ • Get CSV    │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                           ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  INNGEST FUNCTIONS (Background)                           │  │
│  │  • Bulk Import Handler                                    │  │
│  │  • Metadata Generation                                    │  │
│  │  • CSV Generation                                         │  │
│  │  • Result Storage                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                           ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  UTILITY LIBRARIES                                        │  │
│  │  • File Pairing Logic                                     │  │
│  │  • CSV Generator                                          │  │
│  │  • Concurrency Manager                                    │  │
│  │  • Job Store (In-Memory)                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

## Processing Pipeline

```
INPUT: User Files
    │
    ├─► [File Validation]
    │   • Check file types
    │   • Validate pairs
    │   • Category rules
    │
    ├─► [File Pairing]
    │   • Extract base names
    │   • Match image + download
    │   • Handle single-file categories
    │
    ├─► [Upload Phase]
    │   • Concurrent uploads (8-25)
    │   • Retry on failure
    │   • Get CDN URLs
    │
    ├─► [Job Creation]
    │   • Generate Job ID
    │   • Queue background job
    │
    ├─► [Background Processing]
    │   │
    │   ├─► [URL Validation]
    │   │
    │   ├─► [Metadata Generation]
    │   │   • Parallel OpenAI calls (20)
    │   │   • Generate name, description, keywords
    │   │   • Fallback on error
    │   │
    │   ├─► [CSV Generation]
    │   │   • Transform to CSV format
    │   │   • Match admin schema
    │   │
    │   └─► [Result Storage]
    │       • Save to job store
    │       • Send webhook
    │
    ├─► [Polling]
    │   • Check status every 5s
    │   • Update progress
    │
    └─► [Output: CSV File]
        • Download ready CSV
        • Import to Brandex-Admin
```

## Technology Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  • React 19                                                  │
│  • Next.js 16 (App Router)                                   │
│  • Tailwind CSS                                              │
│  • React Dropzone                                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  • Next.js API Routes                                        │
│  • Server Actions                                            │
│  • Client Components                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                      │
│  • File Pairing Algorithm                                    │
│  • Concurrency Management                                    │
│  • Retry Logic                                               │
│  • CSV Generation                                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKGROUND PROCESSING                     │
│  • Inngest Functions                                         │
│  • Event-Driven Architecture                                 │
│  • Step-based Execution                                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  BunnyCDN    │  │   OpenAI     │  │   Inngest    │      │
│  │  (Storage)   │  │   (AI)       │  │   (Jobs)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Concurrency & Performance

```
Upload Phase:
├─ Single File (IMAGES): 25 concurrent uploads
├─ Single File (Other): 15 concurrent uploads
└─ Paired Files: 8 concurrent uploads

Processing Phase:
├─ Metadata Generation: 20 concurrent OpenAI calls
└─ Sequential: URL Validation → CSV Generation → Storage

Retry Strategy:
├─ Upload Retries: 2 attempts
├─ Exponential Backoff: 1s, 2s, 4s
└─ Graceful Degradation: Continue on partial failures
```

