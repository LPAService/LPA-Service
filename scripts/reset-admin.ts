import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

const newPassword = 'Admin@2026!';
const hashed = await bcrypt.hash(newPassword, 10);

await db.update(users)
  .set({ password: hashed })
  .where(eq(users.email, 'admin@caixaescolar.com.br'));

console.log('Updated. New hash:', hashed);
process.exit(0);
