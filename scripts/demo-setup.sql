-- Demo Tenant and Sample Projects Setup
-- This script creates a demo organization with sample data for testing and demonstration

-- Create demo organization
INSERT INTO orgs (id, name, slug, settings) VALUES 
(
    'demo-org-1234-5678-9abc-def0',
    'Demo Organization',
    'demo-org',
    '{
        "plan": "enterprise",
        "features": {
            "keyword_expansion": true,
            "serp_analysis": true,
            "clustering": true,
            "content_briefs": true,
            "exports": true
        },
        "limits": {
            "seeds_per_day": 1000,
            "serp_calls_per_day": 5000,
            "exports_per_day": 100
        }
    }'
) ON CONFLICT (slug) DO NOTHING;

-- Create demo users
INSERT INTO users (id, email, name, avatar_url) VALUES 
(
    'demo-user-1-2345-6789-abcd-ef01',
    'demo@example.com',
    'Demo User',
    'https://ui-avatars.com/api/?name=Demo+User&background=random'
),
(
    'demo-admin-2-3456-7890-bcde-f012',
    'admin@demo.com',
    'Demo Admin',
    'https://ui-avatars.com/api/?name=Demo+Admin&background=random'
) ON CONFLICT (email) DO NOTHING;

-- Create user memberships
INSERT INTO memberships (user_id, org_id, role, permissions) VALUES 
(
    'demo-user-1-2345-6789-abcd-ef01',
    'demo-org-1234-5678-9abc-def0',
    'member',
    '["read:projects", "write:projects", "read:keywords", "write:keywords"]'
),
(
    'demo-admin-2-3456-7890-bcde-f012',
    'demo-org-1234-5678-9abc-def0',
    'admin',
    '["read:projects", "write:projects", "read:keywords", "write:keywords", "admin:org"]'
) ON CONFLICT (user_id, org_id) DO NOTHING;

-- Create sample projects
INSERT INTO projects (id, org_id, name, description, status, settings, created_at, updated_at) VALUES 
(
    'proj-seo-tools-2024',
    'demo-org-1234-5678-9abc-def0',
    'SEO Tools Research 2024',
    'Comprehensive research on SEO tools and software for content marketing teams',
    'active',
    '{
        "target_audience": "content_marketers",
        "content_type": "review",
        "competitors": ["semrush", "ahrefs", "moz"],
        "keywords_per_seed": 50
    }',
    NOW() - INTERVAL '30 days',
    NOW()
),
(
    'proj-content-marketing-guide',
    'demo-org-1234-5678-9abc-def0',
    'Content Marketing Guide',
    'Complete guide to content marketing strategies and best practices',
    'active',
    '{
        "target_audience": "marketers",
        "content_type": "guide",
        "competitors": ["hubspot", "content_marketing_institute"],
        "keywords_per_seed": 30
    }',
    NOW() - INTERVAL '15 days',
    NOW()
),
(
    'proj-email-marketing-campaigns',
    'demo-org-1234-5678-9abc-def0',
    'Email Marketing Campaigns',
    'Research on email marketing campaigns and automation strategies',
    'draft',
    '{
        "target_audience": "email_marketers",
        "content_type": "how_to",
        "competitors": ["mailchimp", "convertkit"],
        "keywords_per_seed": 25
    }',
    NOW() - INTERVAL '7 days',
    NOW()
);

-- Create sample seeds
INSERT INTO seeds (id, project_id, keyword, type, status, metadata, created_at, updated_at) VALUES 
-- SEO Tools Project Seeds
(
    'seed-seo-tools-main',
    'proj-seo-tools-2024',
    'seo tools',
    'keyword',
    'completed',
    '{
        "search_volume": 12000,
        "difficulty": 75,
        "intent": "commercial",
        "expanded_keywords": 45
    }',
    NOW() - INTERVAL '30 days',
    NOW()
),
(
    'seed-best-seo-tools',
    'proj-seo-tools-2024',
    'best seo tools',
    'keyword',
    'completed',
    '{
        "search_volume": 8000,
        "difficulty": 85,
        "intent": "commercial",
        "expanded_keywords": 38
    }',
    NOW() - INTERVAL '28 days',
    NOW()
),
(
    'seed-seo-software',
    'proj-seo-tools-2024',
    'seo software',
    'keyword',
    'processing',
    '{
        "search_volume": 6000,
        "difficulty": 70,
        "intent": "commercial"
    }',
    NOW() - INTERVAL '2 days',
    NOW()
),

-- Content Marketing Project Seeds
(
    'seed-content-marketing',
    'proj-content-marketing-guide',
    'content marketing',
    'keyword',
    'completed',
    '{
        "search_volume": 15000,
        "difficulty": 80,
        "intent": "informational",
        "expanded_keywords": 52
    }',
    NOW() - INTERVAL '15 days',
    NOW()
),
(
    'seed-content-strategy',
    'proj-content-marketing-guide',
    'content strategy',
    'keyword',
    'completed',
    '{
        "search_volume": 9000,
        "difficulty": 75,
        "intent": "informational",
        "expanded_keywords": 41
    }',
    NOW() - INTERVAL '12 days',
    NOW()
),

-- Email Marketing Project Seeds
(
    'seed-email-marketing',
    'proj-email-marketing-campaigns',
    'email marketing',
    'keyword',
    'pending',
    '{
        "search_volume": 18000,
        "difficulty": 85,
        "intent": "informational"
    }',
    NOW() - INTERVAL '7 days',
    NOW()
);

-- Create sample keywords (expanded from seeds)
INSERT INTO keywords (id, project_id, seed_id, keyword, search_volume, difficulty, intent, serp_features, created_at) VALUES 
-- SEO Tools Keywords
(
    'kw-seo-tools-1',
    'proj-seo-tools-2024',
    'seed-seo-tools-main',
    'seo tools for small business',
    5000,
    65,
    'commercial',
    '["featured_snippet", "reviews"]',
    NOW() - INTERVAL '29 days'
),
(
    'kw-seo-tools-2',
    'proj-seo-tools-2024',
    'seed-seo-tools-main',
    'best seo tools 2024',
    8000,
    85,
    'commercial',
    '["featured_snippet", "reviews", "comparison"]',
    NOW() - INTERVAL '29 days'
),
(
    'kw-seo-tools-3',
    'proj-seo-tools-2024',
    'seed-seo-tools-main',
    'free seo tools',
    3000,
    55,
    'commercial',
    '["reviews"]',
    NOW() - INTERVAL '29 days'
),
(
    'kw-seo-tools-4',
    'proj-seo-tools-2024',
    'seed-best-seo-tools',
    'semrush vs ahrefs',
    4000,
    90,
    'commercial',
    '["comparison", "reviews"]',
    NOW() - INTERVAL '27 days'
),
(
    'kw-seo-tools-5',
    'proj-seo-tools-2024',
    'seed-best-seo-tools',
    'seo tools comparison',
    2500,
    75,
    'commercial',
    '["comparison"]',
    NOW() - INTERVAL '27 days'
),

-- Content Marketing Keywords
(
    'kw-content-1',
    'proj-content-marketing-guide',
    'seed-content-marketing',
    'content marketing strategy',
    12000,
    80,
    'informational',
    '["featured_snippet", "how_to"]',
    NOW() - INTERVAL '14 days'
),
(
    'kw-content-2',
    'proj-content-marketing-guide',
    'seed-content-marketing',
    'content marketing examples',
    6000,
    70,
    'informational',
    '["examples"]',
    NOW() - INTERVAL '14 days'
),
(
    'kw-content-3',
    'proj-content-marketing-guide',
    'seed-content-strategy',
    'content strategy framework',
    8000,
    75,
    'informational',
    '["featured_snippet", "how_to"]',
    NOW() - INTERVAL '11 days'
),
(
    'kw-content-4',
    'proj-content-marketing-guide',
    'seed-content-strategy',
    'content calendar template',
    4000,
    60,
    'informational',
    '["templates"]',
    NOW() - INTERVAL '11 days'
);

-- Create sample SERP results
INSERT INTO serp_results (id, keyword_id, position, title, url, snippet, domain, domain_authority, features, created_at) VALUES 
-- SEO Tools SERP Results
(
    'serp-seo-tools-1',
    'kw-seo-tools-1',
    1,
    'Best SEO Tools for Small Business in 2024',
    'https://example.com/seo-tools-small-business',
    'Discover the best SEO tools for small businesses. Compare features, pricing, and find the perfect solution for your needs.',
    'example.com',
    85,
    '["featured_snippet", "reviews"]',
    NOW() - INTERVAL '29 days'
),
(
    'serp-seo-tools-2',
    'kw-seo-tools-1',
    2,
    '15 Essential SEO Tools Every Small Business Needs',
    'https://marketing.com/seo-tools-small-business',
    'Learn about the essential SEO tools that can help small businesses improve their search rankings and online visibility.',
    'marketing.com',
    78,
    '["reviews"]',
    NOW() - INTERVAL '29 days'
),
(
    'serp-seo-tools-3',
    'kw-seo-tools-2',
    1,
    'Top 10 SEO Tools for 2024: Complete Comparison',
    'https://seotools.com/best-seo-tools-2024',
    'Compare the best SEO tools of 2024. Find the perfect tool for keyword research, backlink analysis, and site optimization.',
    'seotools.com',
    92,
    '["featured_snippet", "reviews", "comparison"]',
    NOW() - INTERVAL '29 days'
),

-- Content Marketing SERP Results
(
    'serp-content-1',
    'kw-content-1',
    1,
    'Content Marketing Strategy: The Ultimate Guide',
    'https://contentmarketing.com/strategy-guide',
    'Learn how to create a comprehensive content marketing strategy that drives traffic, leads, and sales.',
    'contentmarketing.com',
    88,
    '["featured_snippet", "how_to"]',
    NOW() - INTERVAL '14 days'
),
(
    'serp-content-2',
    'kw-content-1',
    2,
    'How to Build a Content Marketing Strategy in 2024',
    'https://marketinghub.com/content-strategy',
    'Step-by-step guide to building an effective content marketing strategy for your business.',
    'marketinghub.com',
    82,
    '["how_to"]',
    NOW() - INTERVAL '14 days'
);

-- Create sample clusters
INSERT INTO clusters (id, project_id, label, centroid, metrics, created_at) VALUES 
(
    'cluster-seo-tools',
    'proj-seo-tools-2024',
    'SEO Tools Comparison',
    '[0.1, 0.2, 0.3, ...]',
    '{
        "avg_search_volume": 4500,
        "avg_difficulty": 70,
        "total_keywords": 5,
        "intent_distribution": {
            "commercial": 5
        }
    }',
    NOW() - INTERVAL '28 days'
),
(
    'cluster-content-strategy',
    'proj-content-marketing-guide',
    'Content Strategy',
    '[0.2, 0.3, 0.4, ...]',
    '{
        "avg_search_volume": 7500,
        "avg_difficulty": 71,
        "total_keywords": 4,
        "intent_distribution": {
            "informational": 4
        }
    }',
    NOW() - INTERVAL '12 days'
);

-- Create cluster members
INSERT INTO cluster_members (cluster_id, keyword_id, similarity_score) VALUES 
('cluster-seo-tools', 'kw-seo-tools-1', 0.85),
('cluster-seo-tools', 'kw-seo-tools-2', 0.92),
('cluster-seo-tools', 'kw-seo-tools-3', 0.78),
('cluster-seo-tools', 'kw-seo-tools-4', 0.88),
('cluster-seo-tools', 'kw-seo-tools-5', 0.82),
('cluster-content-strategy', 'kw-content-1', 0.90),
('cluster-content-strategy', 'kw-content-2', 0.85),
('cluster-content-strategy', 'kw-content-3', 0.87),
('cluster-content-strategy', 'kw-content-4', 0.79);

-- Create sample content briefs
INSERT INTO briefs (id, project_id, keyword_id, title, outline, content_type, word_count, status, created_at) VALUES 
(
    'brief-seo-tools-guide',
    'proj-seo-tools-2024',
    'kw-seo-tools-1',
    'Complete Guide to SEO Tools for Small Business',
    '[
        "Introduction to SEO for Small Business",
        "Why Small Businesses Need SEO Tools",
        "Top 10 SEO Tools for Small Business",
        "How to Choose the Right SEO Tool",
        "Implementation Tips and Best Practices",
        "Conclusion and Next Steps"
    ]',
    'guide',
    2500,
    'completed',
    NOW() - INTERVAL '25 days'
),
(
    'brief-content-strategy',
    'proj-content-marketing-guide',
    'kw-content-1',
    'How to Create a Content Marketing Strategy',
    '[
        "What is Content Marketing Strategy",
        "Setting Your Content Marketing Goals",
        "Understanding Your Target Audience",
        "Content Planning and Calendar",
        "Content Creation and Distribution",
        "Measuring Success and Optimization"
    ]',
    'how_to',
    3000,
    'completed',
    NOW() - INTERVAL '10 days'
);

-- Create sample exports
INSERT INTO exports (id, org_id, project_id, type, format, status, file_url, metadata, created_at) VALUES 
(
    'export-seo-tools-csv',
    'demo-org-1234-5678-9abc-def0',
    'proj-seo-tools-2024',
    'keywords',
    'csv',
    'completed',
    'https://demo-storage.com/exports/seo-tools-keywords.csv',
    '{
        "total_keywords": 45,
        "total_clusters": 1,
        "file_size": "2.5MB",
        "download_count": 3
    }',
    NOW() - INTERVAL '20 days'
),
(
    'export-content-marketing-pdf',
    'demo-org-1234-5678-9abc-def0',
    'proj-content-marketing-guide',
    'briefs',
    'pdf',
    'completed',
    'https://demo-storage.com/exports/content-marketing-briefs.pdf',
    '{
        "total_briefs": 2,
        "total_pages": 15,
        "file_size": "5.2MB",
        "download_count": 1
    }',
    NOW() - INTERVAL '5 days'
);

-- Create sample audit log entries
INSERT INTO audit_log (id, org_id, user_id, action, resource_type, resource_id, metadata, created_at) VALUES 
(
    'audit-1',
    'demo-org-1234-5678-9abc-def0',
    'demo-user-1-2345-6789-abcd-ef01',
    'project.created',
    'project',
    'proj-seo-tools-2024',
    '{"project_name": "SEO Tools Research 2024"}',
    NOW() - INTERVAL '30 days'
),
(
    'audit-2',
    'demo-org-1234-5678-9abc-def0',
    'demo-user-1-2345-6789-abcd-ef01',
    'seed.expanded',
    'seed',
    'seed-seo-tools-main',
    '{"keywords_generated": 45}',
    NOW() - INTERVAL '29 days'
),
(
    'audit-3',
    'demo-org-1234-5678-9abc-def0',
    'demo-admin-2-3456-7890-bcde-f012',
    'export.created',
    'export',
    'export-seo-tools-csv',
    '{"export_type": "keywords", "format": "csv"}',
    NOW() - INTERVAL '20 days'
);

-- Update project statistics
UPDATE projects SET 
    total_seeds = (
        SELECT COUNT(*) FROM seeds WHERE project_id = projects.id
    ),
    total_keywords = (
        SELECT COUNT(*) FROM keywords WHERE project_id = projects.id
    ),
    total_clusters = (
        SELECT COUNT(*) FROM clusters WHERE project_id = projects.id
    ),
    total_briefs = (
        SELECT COUNT(*) FROM briefs WHERE project_id = projects.id
    )
WHERE org_id = 'demo-org-1234-5678-9abc-def0';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_demo_keywords_project ON keywords(project_id);
CREATE INDEX IF NOT EXISTS idx_demo_serp_keyword ON serp_results(keyword_id);
CREATE INDEX IF NOT EXISTS idx_demo_cluster_project ON clusters(project_id);
CREATE INDEX IF NOT EXISTS idx_demo_brief_project ON briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_demo_audit_org ON audit_log(org_id);

-- Grant permissions for demo users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
