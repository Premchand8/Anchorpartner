-- PMJ Jewels Anchor Catalogue Supabase Schema Initialization
-- Execute this script in your Supabase SQL Editor.

-- 1. Create custom types
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'partner');

-- 2. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role user_role DEFAULT 'partner'::user_role,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 3. Collections Table (CMS metadata)
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  kicker TEXT,
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  theme JSONB DEFAULT '{"bg": "linear-gradient(135deg, #1a0f24, #120a1a)", "glow": "rgba(210, 160, 255, 0.32)"}'::jsonb,
  cover_image TEXT,
  desktop_banner TEXT,
  mobile_banner TEXT,
  story_text TEXT,
  craftsmanship_text TEXT,
  care_instructions TEXT,
  cta_text TEXT,
  cta_url TEXT,
  visibility JSONB DEFAULT '{"all_partners": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active collections" ON collections
  FOR SELECT USING (active = true OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  ));

CREATE POLICY "Allow admin CRUD on collections" ON collections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Seed initial collections metadata matching standard collections.js definitions
INSERT INTO collections (id, title, subtitle, kicker, display_order, theme, cover_image) VALUES
('sweet-16', 'Sweet 16', 'Sparkling Forever — diamond jewellery curated for the Sweet 16 celebration.', 'Sparkling Forever', 1, '{"bg": "linear-gradient(135deg, #1a0f24 0%, #4a2a6a 48%, #120a1a 100%)", "glow": "rgba(210, 160, 255, 0.32)"}'::jsonb, 'sweet16_cover'),
('royal-heritage', 'Royal Heritage', 'Regal polki, uncut diamonds, and heirloom gold craftsmanship.', 'Heirloom Craft', 2, '{"bg": "linear-gradient(135deg, #3a0a12 0%, #6b1525 45%, #2a0810 100%)", "glow": "rgba(220, 60, 80, 0.35)"}'::jsonb, 'royal_heritage_cover'),
('bridal-elegance', 'Bridal Elegance', 'Statement pieces curated for wedding and celebration moments.', 'Celebrate Forever', 3, '{"bg": "linear-gradient(135deg, #3d2a10 0%, #8a6528 50%, #2a1e0c 100%)", "glow": "rgba(255, 200, 100, 0.4)"}'::jsonb, 'bridal_elegance_cover'),
('temple-jewellery', 'Temple Jewellery', 'Sacred Lakshmi motifs, peacocks, and temple artistry in gold.', 'Sacred Motifs', 4, '{"bg": "linear-gradient(160deg, #1a1510 0%, #3d3428 55%, #0f0d0a 100%)", "glow": "rgba(199, 162, 82, 0.25)"}'::jsonb, 'temple_jewellery_cover'),
('diamond-collection', 'Diamond Collection', 'Brilliant solitaires, modern pavé designs, and timeless diamond masterpieces.', 'Brilliant Light', 5, '{"bg": "linear-gradient(135deg, #0f1c2e 0%, #1e3a5f 50%, #08101c 100%)", "glow": "rgba(100, 180, 255, 0.3)"}'::jsonb, 'diamond_collection_cover'),
('everyday-luxury', 'Everyday Luxury', 'Minimalist diamond bands, delicate chains, and contemporary gold accents.', 'Modern Elegance', 6, '{"bg": "linear-gradient(135deg, #141f19 0%, #2e4a3c 50%, #0a120e 100%)", "glow": "rgba(120, 220, 180, 0.25)"}'::jsonb, 'everyday_luxury_cover'),
('antique-collection', 'Antique Collection', 'Traditional design accents with rustic gold finishes and vintage motifs.', 'Vintage Splendour', 7, '{"bg": "linear-gradient(135deg, #241c10 0%, #4a3c25 50%, #171109 100%)", "glow": "rgba(230, 190, 120, 0.28)"}'::jsonb, 'antique_collection_cover'),
('kids-collection', 'Kids Collection', 'Charm pendants, adjustable bands, and playful gold treasures for little ones.', 'Playful Treasures', 8, '{"bg": "linear-gradient(135deg, #242210 0%, #474420 50%, #141309 100%)", "glow": "rgba(220, 210, 100, 0.2)"}'::jsonb, NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Products Table (Master catalogue)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, -- LabelNo / Barcode
  name TEXT NOT NULL,
  cat TEXT NOT NULL,
  cat_label TEXT,
  description TEXT,
  availability TEXT DEFAULT 'mto', -- 'ready' | 'mto'
  images TEXT[] DEFAULT '{}',
  purity TEXT,
  gross_weight TEXT,
  net_gold TEXT,
  diamond_weight TEXT,
  stones TEXT,
  price TEXT,
  collections TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to products" ON products
  FOR SELECT USING (true);

CREATE POLICY "Allow admin CRUD on products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 5. Pricing Settings Table
CREATE TABLE IF NOT EXISTS pricing_settings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  gold_rate NUMERIC NOT NULL,
  import_duty NUMERIC NOT NULL,
  default_wastage NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  effective_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to pricing_settings" ON pricing_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow admin CRUD on pricing_settings" ON pricing_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Insert initial pricing settings
INSERT INTO pricing_settings (gold_rate, import_duty, default_wastage, currency)
VALUES (72.50, 15.00, 10.00, 'USD');

-- 6. Email Configuration Table
CREATE TABLE IF NOT EXISTS email_config (
  id INT PRIMARY KEY DEFAULT 1,
  smtp_host TEXT NOT NULL,
  port INT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  ssl_tls BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin CRUD on email_config" ON email_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 7. Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}'
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin CRUD on email_templates" ON email_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Seed customer selection template
INSERT INTO email_templates (id, subject, body, variables)
VALUES (
  'customer_selection',
  'Customer Selection Details - {{CustomerName}}',
  'Dear {{PartnerName}},\n\nA new customer curation has been submitted. Please review the details below:\n\n**Customer Details**:\n- **Name**: {{CustomerName}}\n- **Phone**: {{Phone}}\n\n**Curated Selections**:\n{{ProductTable}}\n\n**Notes/Requests**:\n{{Notes}}\n\nBest Regards,\nPMJ Jewels',
  '{"CustomerName", "PartnerName", "Phone", "ProductTable", "Notes"}'::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 8. Customer Selections (Wishlists) Table
CREATE TABLE IF NOT EXISTS wishlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  partner_name TEXT,
  executive_name TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Submitted', -- 'Draft' | 'Submitted' | 'Reviewed' | 'Approved'
  quantity INT DEFAULT 0,
  estimated_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Allow users to create selections and read their own. Admins can read all.
CREATE POLICY "Allow users to create selections" ON wishlists
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to view own selections" ON wishlists
  FOR SELECT USING (
    partner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Allow admin to update selections" ON wishlists
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin CRUD on audit_logs" ON audit_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- 10. Upload History Table
CREATE TABLE IF NOT EXISTS upload_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  total_records INT,
  created_count INT,
  updated_count INT,
  failed_count INT,
  error_report JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin CRUD on upload_history" ON upload_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );
