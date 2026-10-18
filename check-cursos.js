import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql1 = fs.readFileSync('09_fix_schemas.sql', 'utf8');
  const sql2 = fs.readFileSync('10_public_config_policy.sql', 'utf8');
  const sql3 = fs.readFileSync('11_fix_password_reset_policy.sql', 'utf8');
  
  console.log('--- POR FAVOR EJECUTA ESTOS SCRIPTS EN EL SQL EDITOR DE SUPABASE ---');
  console.log('\n--- 09_fix_schemas.sql ---\n', sql1);
  console.log('\n--- 10_public_config_policy.sql ---\n', sql2);
  console.log('\n--- 11_fix_password_reset_policy.sql ---\n', sql3);
}
run();