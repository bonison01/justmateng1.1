// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Load environment variables (for Node.js apps, if necessary)
import 'dotenv/config'; // This line is necessary if you're using dotenv for non-Next.js apps

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
