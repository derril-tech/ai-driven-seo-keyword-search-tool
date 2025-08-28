-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Create organizations table
CREATE TABLE IF NOT EXISTS orgs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create memberships table (RLS by org_id)
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, strategist, writer, viewer
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create seeds table
CREATE TABLE IF NOT EXISTS seeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    keyword VARCHAR(500) NOT NULL,
    url TEXT,
    domain VARCHAR(255),
    seed_type VARCHAR(50) DEFAULT 'keyword', -- keyword, url, domain
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create keywords table
CREATE TABLE IF NOT EXISTS keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    seed_id UUID REFERENCES seeds(id) ON DELETE SET NULL,
    keyword VARCHAR(500) NOT NULL,
    search_volume INTEGER,
    difficulty_score DECIMAL(3,2),
    traffic_potential DECIMAL(3,2),
    intent_type VARCHAR(50), -- informational, commercial, transactional, navigational, local
    serp_features JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SERP results table
CREATE TABLE IF NOT EXISTS serp_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title VARCHAR(500),
    url TEXT NOT NULL,
    snippet TEXT,
    domain VARCHAR(255),
    features JSONB DEFAULT '[]', -- PAA, featured snippet, video, local, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pages table (scraped content)
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT UNIQUE NOT NULL,
    title VARCHAR(500),
    h1 VARCHAR(500),
    content TEXT,
    outline JSONB DEFAULT '[]',
    schema_types JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    embedding vector(768), -- Sentence-BERT embedding
    model_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create clusters table
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    description TEXT,
    keywords_count INTEGER DEFAULT 0,
    centroid vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cluster members table
CREATE TABLE IF NOT EXISTS cluster_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cluster_id, keyword_id)
);

-- Create entities table
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    entity_text VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL, -- PERSON, ORG, LOC, etc.
    confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create intent scores table
CREATE TABLE IF NOT EXISTS intent_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    informational DECIMAL(3,2) DEFAULT 0,
    commercial DECIMAL(3,2) DEFAULT 0,
    transactional DECIMAL(3,2) DEFAULT 0,
    navigational DECIMAL(3,2) DEFAULT 0,
    local DECIMAL(3,2) DEFAULT 0,
    confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create briefs table
CREATE TABLE IF NOT EXISTS briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    outline JSONB DEFAULT '[]',
    faqs JSONB DEFAULT '[]',
    entities JSONB DEFAULT '[]',
    internal_links JSONB DEFAULT '[]',
    meta_suggestions JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft', -- draft, approved, published
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exports table
CREATE TABLE IF NOT EXISTS exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    export_type VARCHAR(50) NOT NULL, -- csv, xlsx, pdf, json
    file_path TEXT,
    file_size BIGINT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON memberships(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_seeds_project ON seeds(project_id);
CREATE INDEX IF NOT EXISTS idx_keywords_project ON keywords(project_id);
CREATE INDEX IF NOT EXISTS idx_keywords_seed ON keywords(seed_id);
CREATE INDEX IF NOT EXISTS idx_serp_results_keyword ON serp_results(keyword_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_keyword ON embeddings(keyword_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_page ON embeddings(page_id);
CREATE INDEX IF NOT EXISTS idx_clusters_project ON clusters(project_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_keyword ON cluster_members(keyword_id);
CREATE INDEX IF NOT EXISTS idx_entities_keyword ON entities(keyword_id);
CREATE INDEX IF NOT EXISTS idx_entities_page ON entities(page_id);
CREATE INDEX IF NOT EXISTS idx_intent_scores_keyword ON intent_scores(keyword_id);
CREATE INDEX IF NOT EXISTS idx_briefs_project ON briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_briefs_cluster ON briefs(cluster_id);
CREATE INDEX IF NOT EXISTS idx_exports_project ON exports(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Create vector indexes for similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_clusters_centroid ON clusters USING ivfflat (centroid vector_cosine_ops) WITH (lists = 100);

-- Enable Row Level Security
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE serp_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic - will be enhanced with Casbin)
CREATE POLICY "Users can view their org's data" ON memberships FOR SELECT USING (org_id IN (
    SELECT org_id FROM memberships WHERE user_id = current_setting('app.current_user_id')::UUID
));

-- Insert sample data for development
INSERT INTO orgs (id, name, slug) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'Demo Organization', 'demo-org')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'admin@demo.com', '$2b$10$demo.hash.for.development', 'Admin', 'User')
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO projects (id, org_id, name, description) VALUES 
    ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Demo Project', 'A sample project for testing')
ON CONFLICT DO NOTHING;
