# Supabase

The game's backend. `migrations/` holds the database: tables, row-level security and the server
functions the app calls.

## Setting up a project

1. Create a project at supabase.com.
2. Authentication → Sign In / Providers: turn on **Allow anonymous sign-ins** (players start as guests).
3. Apply the migrations in order: paste each file in `migrations/` into the SQL editor and run it,
   or link the CLI (`supabase link --project-ref <ref>`) and run `supabase db push`.
4. Put the project URL and publishable key in `.env` (see `.env.example`).
