-- Supabase Auth Schema for GoTrue
-- Based on official Supabase auth schema

-- Grant permissions to auth admin
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;

-- Set search path
ALTER ROLE supabase_auth_admin SET search_path TO auth, public;

-- Create auth.users table
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    aud varchar(255),
    role varchar(255),
    email varchar(255) UNIQUE,
    encrypted_password varchar(255),
    email_confirmed_at timestamptz,
    invited_at timestamptz,
    confirmation_token varchar(255),
    confirmation_sent_at timestamptz,
    recovery_token varchar(255),
    recovery_sent_at timestamptz,
    email_change_token_new varchar(255),
    email_change varchar(255),
    email_change_sent_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    phone varchar(15) UNIQUE,
    phone_confirmed_at timestamptz,
    phone_change varchar(15),
    phone_change_token varchar(255),
    phone_change_sent_at timestamptz,
    confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current varchar(255),
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamptz,
    reauthentication_token varchar(255),
    reauthentication_sent_at timestamptz,
    is_sso_user boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    is_anonymous boolean NOT NULL DEFAULT false
);

-- Create auth.refresh_tokens table
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    instance_id uuid,
    id bigserial PRIMARY KEY,
    token varchar(255),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked boolean,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    parent varchar(255),
    session_id uuid
);

-- Create auth.instances table
CREATE TABLE IF NOT EXISTS auth.instances (
    id uuid NOT NULL PRIMARY KEY,
    uuid uuid,
    raw_base_config text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create auth.audit_log_entries table
CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    payload json,
    created_at timestamptz DEFAULT now(),
    ip_address varchar(64) NOT NULL DEFAULT ''
);

-- Create auth.schema_migrations table
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version varchar(14) NOT NULL PRIMARY KEY
);

-- Create auth.identities table
CREATE TABLE IF NOT EXISTS auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    email text GENERATED ALWAYS AS (lower((identity_data->>'email')::text)) STORED,
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider)
);

-- Create auth.sessions table
CREATE TABLE IF NOT EXISTS auth.sessions (
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    factor_id uuid,
    aal text,
    not_after timestamptz,
    refreshed_at timestamp,
    user_agent text,
    ip inet,
    tag text
);

-- Create auth.mfa_factors table
CREATE TABLE IF NOT EXISTS auth.mfa_factors (
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friendly_name text,
    factor_type text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    secret text,
    phone text,
    last_challenged_at timestamptz
);

-- Create auth.mfa_challenges table
CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    factor_id uuid NOT NULL REFERENCES auth.mfa_factors(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    verified_at timestamptz,
    ip_address inet NOT NULL,
    otp_code text
);

-- Create auth.mfa_amr_claims table
CREATE TABLE IF NOT EXISTS auth.mfa_amr_claims (
    session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    authentication_method text NOT NULL,
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method)
);

-- Create auth.sso_providers table
CREATE TABLE IF NOT EXISTS auth.sso_providers (
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    resource_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create auth.sso_domains table
CREATE TABLE IF NOT EXISTS auth.sso_domains (
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    sso_provider_id uuid NOT NULL REFERENCES auth.sso_providers(id) ON DELETE CASCADE,
    domain text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT sso_domains_domain_key UNIQUE (domain)
);

-- Create auth.saml_providers table
CREATE TABLE IF NOT EXISTS auth.saml_providers (
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    sso_provider_id uuid NOT NULL REFERENCES auth.sso_providers(id) ON DELETE CASCADE,
    entity_id text NOT NULL UNIQUE,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    name_id_format text
);

-- Create auth.saml_relay_states table
CREATE TABLE IF NOT EXISTS auth.saml_relay_states (
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    sso_provider_id uuid NOT NULL REFERENCES auth.sso_providers(id) ON DELETE CASCADE,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    flow_state_id uuid
);

-- Create auth.flow_state table
CREATE TABLE IF NOT EXISTS auth.flow_state (
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method text NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    authentication_method text NOT NULL,
    auth_code_issued_at timestamptz
);

-- Create auth.one_time_tokens table
CREATE TABLE IF NOT EXISTS auth.one_time_tokens (
    id uuid NOT NULL PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_type text NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT one_time_tokens_token_hash_hash_type_key UNIQUE (token_hash, token_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users (instance_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (email);
CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_idx ON auth.refresh_tokens (instance_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens (instance_id, user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON auth.refresh_tokens (token);
CREATE INDEX IF NOT EXISTS refresh_tokens_session_id_idx ON auth.refresh_tokens (session_id);
CREATE INDEX IF NOT EXISTS audit_logs_instance_id_idx ON auth.audit_log_entries (instance_id);
CREATE INDEX IF NOT EXISTS identities_user_id_idx ON auth.identities (user_id);
CREATE INDEX IF NOT EXISTS identities_email_idx ON auth.identities (email);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_not_after_idx ON auth.sessions (not_after);
CREATE INDEX IF NOT EXISTS mfa_factors_user_id_idx ON auth.mfa_factors (user_id);
CREATE INDEX IF NOT EXISTS flow_state_created_at_idx ON auth.flow_state (created_at);
CREATE INDEX IF NOT EXISTS one_time_tokens_user_id_token_type_idx ON auth.one_time_tokens (user_id, token_type);
CREATE INDEX IF NOT EXISTS one_time_tokens_relates_to_idx ON auth.one_time_tokens (relates_to);

-- Grant SELECT on auth.users to authenticated and service_role
GRANT SELECT ON auth.users TO authenticated, service_role;
GRANT ALL ON auth.users TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION auth.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_users') THEN
        CREATE TRIGGER set_updated_at_users
            BEFORE UPDATE ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION auth.set_updated_at();
    END IF;
END $$;

-- Grant usage on schema
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role, supabase_auth_admin;
