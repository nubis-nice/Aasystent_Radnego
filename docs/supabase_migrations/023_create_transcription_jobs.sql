-- 023_create_transcription_jobs.sql
-- Tworzy tabelę na potrzeby trwałego przechowywania statusów zadań transkrypcji YouTube

create table if not exists public.transcription_jobs (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    video_url text not null,
    video_title text not null,
    session_id text null,
    status text not null default 'pending',
    progress integer not null default 0,
    progress_message text null,
    include_sentiment boolean not null default true,
    identify_speakers boolean not null default true,
    created_at timestamptz not null default now(),
    completed_at timestamptz null,
    error text null,
    result_document_id uuid null,
    audio_issues jsonb null,
    metadata jsonb null
);

create index if not exists transcription_jobs_user_id_idx
    on public.transcription_jobs (user_id);

create index if not exists transcription_jobs_status_idx
    on public.transcription_jobs (status);
