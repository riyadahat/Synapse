# SYNAPSE

### Where knowledge connects. Work continues.

SYNAPSE is an AI-powered team knowledge and workflow platform designed
to help teams turn meetings, documents, and conversations into clear
decisions, actionable tasks, and reliable handovers.

Instead of letting important context disappear across meeting notes,
chats, and files, SYNAPSE brings that context into one searchable
workspace.

> **Project status:** Active development / portfolio project\
> **Stack:** Next.js · TypeScript · Supabase · Google Gemini · Tailwind
> CSS

------------------------------------------------------------------------

## Contents

-   [Why SYNAPSE?](#why-synapse)
-   [What it does](#what-it-does)
-   [Product highlights](#product-highlights)
-   [Technology stack](#technology-stack)
-   [Architecture](#architecture)
-   [Getting started](#getting-started)
-   [Environment variables](#environment-variables)
-   [Database setup](#database-setup)
-   [Demo workspace](#demo-workspace)
-   [AI integration](#ai-integration)
-   [Security notes](#security-notes)
-   [Project structure](#project-structure)
-   [Roadmap](#roadmap)
-   [Contributing](#contributing)

------------------------------------------------------------------------

## Why SYNAPSE?

Teams do not usually lose information because nobody wrote it down. They
lose it because information is scattered, disconnected, or never
converted into action.

A meeting produces decisions. Decisions create tasks. Tasks evolve, get
blocked, and change owners. Documents provide supporting context. When
someone joins a project or takes over work, they need the full
picture---not another collection of disconnected updates.

SYNAPSE is built around that connected workflow:

**Capture → Understand → Organize → Act → Hand over**

## What it does

SYNAPSE provides a shared workspace for managing team knowledge and
execution.

  -----------------------------------------------------------------------
  Area                                Purpose
  ----------------------------------- -----------------------------------
  Dashboard                           Get an overview of team work and
                                      recent activity

  Meetings                            Capture meeting notes and extract
                                      structured summaries, decisions,
                                      and action items

  Tasks                               Track ownership, priority, status,
                                      deadlines, and task history

  Catch Me Up                         Help a team member understand what
                                      changed and what needs attention

  Smart Handovers                     Package project context when work
                                      moves between people

  Knowledge Base                      Upload and organize reference
                                      documents for later retrieval

  Ask SYNAPSE                         Ask questions about workspace
                                      context and receive AI-generated
                                      responses

  Activity                            Review important workspace events

  Context Health                      Surface the state and completeness
                                      of project context
  -----------------------------------------------------------------------

*Feature availability depends on the current implementation and
configured services.*

## Product highlights

### 1. Meeting intelligence

Turn unstructured meeting notes into structured information. The
AI-assisted workflow can identify discussion points, decisions, action
items, ownership clues, and deadlines. Review extracted information
before saving it.

### 2. Tasks with context

Tasks are more than a title and a checkbox. SYNAPSE is designed to
connect work with owners, priorities, statuses, deadlines, meeting
origins, and task history.

### 3. Catch Me Up

Generate a concise view of relevant changes, decisions, deadlines,
blockers, and suggested next steps so a teammate can regain context
quickly.

### 4. Smart Handovers

Create a structured handover when responsibility changes. The goal is to
transfer progress, outstanding work, decisions, blockers, resources, and
next steps---not just assign a task to another person.

### 5. Searchable knowledge

Upload supported documents and make their content available to the
workspace knowledge workflow. Extracted text is divided into searchable
chunks so relevant context can be retrieved later.

### 6. Ask SYNAPSE

Ask natural-language questions about the information available in the
workspace. AI responses are designed to use retrieved workspace context
and supporting references where available.

------------------------------------------------------------------------

## Technology stack

  Layer                   Technology
  ----------------------- -------------------------------------------
  Web application         Next.js App Router
  Language                TypeScript
  UI                      React, Tailwind CSS
  Backend services        Next.js Server Actions and Route Handlers
  Database                Supabase PostgreSQL
  Authentication          Supabase Auth
  File storage            Supabase Storage
  Access control          Supabase Row Level Security (RLS)
  AI provider             Google Gemini via `@google/genai`
  Structured validation   Zod
  Deployment              Render (configured deployment)

## Architecture

``` mermaid
flowchart TD
    U[Team member] --> UI[Next.js application]
    UI --> SA[Server Actions / API routes]
    SA --> AUTH[Supabase Auth]
    SA --> DB[(Supabase PostgreSQL)]
    SA --> STORAGE[Supabase Storage]
    SA --> RETRIEVE[Workspace context retrieval]
    RETRIEVE --> DB
    RETRIEVE --> STORAGE
    SA --> AI[Google Gemini]
    AI --> VALIDATE[Zod validation]
    VALIDATE --> SA
    SA --> UI
```

**Request flow:** the browser interacts with the Next.js application;
server-side actions access Supabase and call Gemini when an AI operation
is requested. AI output is validated against application schemas before
it is used.

------------------------------------------------------------------------

## Getting started

### Prerequisites

-   Node.js 20.6 or newer
-   npm
-   A Supabase project
-   A Google Gemini API key
-   Git

### 1. Clone the repository

``` bash
git clone https://github.com/YOUR_USERNAME/SYNAPSE.git
cd SYNAPSE
```

Replace `YOUR_USERNAME` with the GitHub account that hosts the
repository.

### 2. Install dependencies

``` bash
npm install
```

### 3. Configure environment variables

Create a local environment file:

``` bash
cp .env.example .env.local
```

Open `.env.local` and add your own credentials. See [Environment
variables](#environment-variables).

### 4. Configure Supabase

1.  Create a Supabase project.
2.  Open the Supabase SQL Editor.
3.  Run the contents of `supabase-schema.sql` to create the application
    schema, policies, and related database objects.
4.  Confirm that the required tables and private document storage bucket
    exist.

**Important:** the schema file is an initial setup script, not a
repeatable reset script. Do not run it again on a database that already
has the schema without first reviewing the SQL and understanding its
effects.

### 5. Start the development server

``` bash
npm run dev
```

Open <http://localhost:3000>.

### 6. Check the project

``` bash
npx tsc --noEmit
```

------------------------------------------------------------------------

## Environment variables

Use `.env.example` as the template. Never commit `.env.local` or real
credentials.

  ---------------------------------------------------------------------------------------------
  Variable                                                     Required Description
  ---------------------------------------- ---------------------------- -----------------------
  `NEXT_PUBLIC_SUPABASE_URL`                                        Yes Supabase project URL

  `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                   Yes Supabase
                                                                        publishable/anonymous
                                                                        client key used by the
                                                                        app

  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                If used by your Supabase publishable
                                                          configuration key

  `SUPABASE_SERVICE_ROLE_KEY`                  Yes for admin operations Server-only Supabase
                                                                        secret/service-role key

  `GEMINI_API_KEY`                                      For AI features Google Gemini API key

  `GEMINI_MODEL`                                               Optional Gemini model name;
                                                                        defaults to the value
                                                                        configured in the
                                                                        application

  `AI_TIMEOUT_MS`                                              Optional AI request timeout

  `AI_MAX_ATTEMPTS`                                            Optional Maximum AI attempts

  `LOG_LEVEL`                                                  Optional Application logging
                                                                        level

  `LOG_TO_FILE`                                                Optional Whether file logging is
                                                                        enabled

  `DEMO_PASSWORD`                                      For demo seeding Password assigned to
                                                                        fictional demo accounts

  `NEXT_PUBLIC_DEMO_ENABLED`                                   Optional Enables or disables
                                                                        demo entry UI where
                                                                        implemented
  ---------------------------------------------------------------------------------------------

Example placeholders:

``` env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-secret-key

GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=your-supported-gemini-model

AI_TIMEOUT_MS=45000
AI_MAX_ATTEMPTS=2
LOG_LEVEL=info
LOG_TO_FILE=false

DEMO_PASSWORD=change-this-demo-password
NEXT_PUBLIC_DEMO_ENABLED=false
```

Use the exact variable names expected by the checked-out code. Keep
service-role and AI keys server-side only; never prefix them with
`NEXT_PUBLIC_`.

------------------------------------------------------------------------

## Database setup

The Supabase schema is provided in:

``` text
supabase-schema.sql
```

The schema includes the core workspace data model, including:

-   Profiles, teams, and team memberships
-   Meetings, participants, and decisions
-   Tasks, meeting-task links, and task history
-   Handovers and handover-task links
-   Documents, document chunks, and task-document links
-   Activity logs

Row Level Security is enabled in the schema to help isolate workspace
data. Review the policies against your own product requirements before
using this project with real users or sensitive information.

------------------------------------------------------------------------

## Demo workspace

A demo seeding script is provided at:

``` text
scripts/seed-demo.mjs
```

If your local environment is configured with the required Supabase
credentials and demo settings, run:

``` bash
npm run seed
```

The script creates a fictional SYNAPSE Product Launch workspace with
example team members and connected sample records for exploring the
application.

The demo setup includes sample meetings, tasks, decisions, knowledge
records, handovers, and activity entries.

**Use only in a development/demo Supabase project.** The script may
remove and recreate a previously seeded demo workspace. Read
`scripts/seed-demo.mjs` before running it against any database
containing important data. Do not expose demo passwords or service-role
credentials.

------------------------------------------------------------------------

## AI integration

SYNAPSE uses Google's Gemini API through the official `@google/genai`
JavaScript SDK.

The AI service layer is centralized in:

``` text
src/lib/ai.ts
```

It provides a shared structured-generation interface for AI-backed
workflows. Responses are validated with Zod schemas before being
returned to application actions.

AI features require a valid Gemini API key and an available model/quota
for the Google AI project. Model availability and free-tier limits can
change; configure a model supported by your account and region.

If AI is unavailable, the application may show a friendly error and
allow supported manual workflows to continue.

------------------------------------------------------------------------

## Security notes

Before deploying or using real team data:

-   Keep `.env.local` out of version control.
-   Never expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` to
    browser code.
-   Use Render's environment settings for production secrets.
-   Keep Supabase Row Level Security enabled and review every policy.
-   Use a separate Supabase project for demos and development.
-   Change demo passwords before sharing a demo environment.
-   Avoid uploading confidential documents to a public demo workspace.
-   Rotate any credential that has accidentally been committed or
    shared.
-   Review authentication, authorization, storage access, and rate
    limits before production use.

------------------------------------------------------------------------

## Project structure

``` text
SYNAPSE/
├── scripts/
│   └── seed-demo.mjs
├── src/
│   ├── app/
│   │   ├── (app)/          # Authenticated application pages
│   │   ├── actions/        # Server actions
│   │   ├── api/            # API routes
│   │   └── ...
│   ├── components/         # Shared React components
│   ├── lib/
│   │   ├── ai.ts           # Gemini integration and validation
│   │   ├── prompts.ts      # AI prompts
│   │   ├── schemas.ts      # Zod schemas
│   │   └── supabase/       # Supabase clients
│   └── types/
├── supabase-schema.sql
├── .env.example
├── package.json
└── README.md
```

------------------------------------------------------------------------

## Roadmap

Potential next improvements:

-   [ ] Expand automated tests for core workflows
-   [ ] Add robust AI request tracing and quota-aware handling
-   [ ] Improve document retrieval and citation quality
-   [ ] Add richer task analytics and team workload views
-   [ ] Add production monitoring and error reporting
-   [ ] Add CI checks for linting, type checking, and builds
-   [ ] Review accessibility and responsive behavior across devices
-   [ ] Complete a production security and RLS review

------------------------------------------------------------------------

## Contributing

Contributions, issues, and suggestions are welcome.

1.  Fork the repository.
2.  Create a feature branch.
3.  Make your changes.
4.  Run the available checks.
5.  Open a pull request with a clear description.

------------------------------------------------------------------------

## Author

**SYNAPSE** --- Where knowledge connects. Work continues.

Built as a full-stack project exploring AI-assisted knowledge
management, structured workflows, and team context continuity.

------------------------------------------------------------------------

```{=html}
<p align="center">
```
`<strong>`{=html}Turn scattered information into connected
work.`</strong>`{=html}
```{=html}
</p>
```
