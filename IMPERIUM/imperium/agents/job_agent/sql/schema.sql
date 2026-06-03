-- Imperium Job Agent — SQLite schema
-- Compatible with future PostgreSQL migration:
--   TEXT PRIMARY KEY  -> VARCHAR/UUID
--   TEXT NOT NULL     -> VARCHAR NOT NULL
--   REAL              -> NUMERIC / FLOAT8
--   INTEGER           -> BIGINT / INTEGER
-- ----------------------------------------------------------------

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -8000;   -- 8 MB page cache

-- ----------------------------------------------------------------
-- Candidate Profiles
-- One row per unique profile_id; UPSERT on conflict.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_profiles (
    profile_id           TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    contact_json         TEXT NOT NULL DEFAULT '{}',
    skills_json          TEXT NOT NULL DEFAULT '[]',
    work_experience_json TEXT NOT NULL DEFAULT '[]',
    education_json       TEXT NOT NULL DEFAULT '[]',
    projects_json        TEXT NOT NULL DEFAULT '[]',
    certifications_json  TEXT NOT NULL DEFAULT '[]',
    portfolio_links_json TEXT NOT NULL DEFAULT '[]',
    github_repositories_json TEXT NOT NULL DEFAULT '[]',
    linkedin_profile     TEXT NOT NULL DEFAULT '',
    preferences_json     TEXT NOT NULL DEFAULT '{}',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_updated_at
    ON candidate_profiles(updated_at DESC);

-- ----------------------------------------------------------------
-- Job Listings
-- Deduplication key: (source, external_id)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_listings (
    listing_id               TEXT PRIMARY KEY,
    source                   TEXT NOT NULL,
    external_id              TEXT NOT NULL,
    url                      TEXT NOT NULL DEFAULT '',
    title                    TEXT NOT NULL,
    company                  TEXT NOT NULL,
    location                 TEXT NOT NULL DEFAULT '',
    salary_min               REAL,
    salary_max               REAL,
    salary_currency          TEXT NOT NULL DEFAULT 'USD',
    required_skills_json     TEXT NOT NULL DEFAULT '[]',
    experience_years         REAL,
    education_requirements_json TEXT NOT NULL DEFAULT '[]',
    technology_stack_json    TEXT NOT NULL DEFAULT '[]',
    description              TEXT NOT NULL DEFAULT '',
    posted_at                TEXT NOT NULL DEFAULT '',
    discovered_at            TEXT NOT NULL,
    metadata_json            TEXT NOT NULL DEFAULT '{}',
    match_score              REAL,
    status                   TEXT NOT NULL DEFAULT 'discovered',
    UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_job_listings_company_title
    ON job_listings(company, title);
CREATE INDEX IF NOT EXISTS idx_job_listings_discovered_at
    ON job_listings(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_listings_match_score
    ON job_listings(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_listings_status
    ON job_listings(status);

-- ----------------------------------------------------------------
-- Applications
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
    application_id   TEXT PRIMARY KEY,
    listing_id       TEXT NOT NULL,
    company          TEXT NOT NULL,
    job_title        TEXT NOT NULL,
    date_applied     TEXT NOT NULL,
    status           TEXT NOT NULL,
    match_score      REAL NOT NULL DEFAULT 0.0,
    resume_path      TEXT NOT NULL DEFAULT '',
    cover_letter_path TEXT NOT NULL DEFAULT '',
    last_updated     TEXT NOT NULL,
    notes            TEXT NOT NULL DEFAULT '',
    metadata_json    TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(listing_id) REFERENCES job_listings(listing_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_applications_status
    ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_date_applied
    ON applications(date_applied DESC);
CREATE INDEX IF NOT EXISTS idx_applications_listing_id
    ON applications(listing_id);
CREATE INDEX IF NOT EXISTS idx_applications_company
    ON applications(company);

-- ----------------------------------------------------------------
-- Application status history (full audit trail)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_status_history (
    event_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id   TEXT NOT NULL,
    status           TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    notes            TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(application_id) REFERENCES applications(application_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_app_status_history_app_id
    ON application_status_history(application_id);

-- ----------------------------------------------------------------
-- Recruiter Events
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recruiter_events (
    event_id      TEXT PRIMARY KEY,
    source        TEXT NOT NULL,
    company       TEXT NOT NULL,
    job_title     TEXT NOT NULL DEFAULT '',
    message       TEXT NOT NULL,
    status_hint   TEXT NOT NULL DEFAULT '',
    occurred_at   TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_recruiter_events_occurred_at
    ON recruiter_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruiter_events_company
    ON recruiter_events(company);

-- ----------------------------------------------------------------
-- Notifications
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    notification_id TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    channel         TEXT NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'normal',
    created_at      TEXT NOT NULL,
    read_at         TEXT,
    metadata_json   TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_channel_priority
    ON notifications(channel, priority);

-- ----------------------------------------------------------------
-- Strategy History
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS strategy_history (
    snapshot_id              TEXT PRIMARY KEY,
    created_at               TEXT NOT NULL,
    scan_interval_hours      INTEGER NOT NULL DEFAULT 6,
    min_match_threshold      REAL NOT NULL DEFAULT 0.72,
    daily_application_limit  INTEGER NOT NULL DEFAULT 20,
    target_roles_json        TEXT NOT NULL DEFAULT '[]',
    preferred_sources_json   TEXT NOT NULL DEFAULT '[]',
    keyword_blacklist_json   TEXT NOT NULL DEFAULT '[]',
    keyword_boost_json       TEXT NOT NULL DEFAULT '[]',
    metrics_json             TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_strategy_history_created_at
    ON strategy_history(created_at DESC);

-- ----------------------------------------------------------------
-- Agent Activity Log  (NEW — real-time activity feed)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_activity_log (
    log_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      TEXT NOT NULL DEFAULT '',
    agent        TEXT NOT NULL,
    action       TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'ok',
    detail       TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_log_task_id
    ON agent_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_log_created_at
    ON agent_activity_log(created_at DESC);

-- ----------------------------------------------------------------
-- Profile Completeness Cache  (NEW — avoid re-computing on every request)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_health (
    profile_id    TEXT PRIMARY KEY,
    score         REAL NOT NULL DEFAULT 0.0,
    missing_json  TEXT NOT NULL DEFAULT '[]',
    computed_at   TEXT NOT NULL,
    FOREIGN KEY(profile_id) REFERENCES candidate_profiles(profile_id) ON DELETE CASCADE
);
