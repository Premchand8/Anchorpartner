import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://exrzkkwyzagadfngzhyf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable__3QPKY0YG7X6cW1MF9OYZQ_S9MF9o5D';

export const supabase = createClient(supabaseUrl, supabaseKey);
