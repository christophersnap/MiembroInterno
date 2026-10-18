import dotenv from 'dotenv';
dotenv.config();

console.log('Available process.env keys:');
console.log(Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('VITE')));
