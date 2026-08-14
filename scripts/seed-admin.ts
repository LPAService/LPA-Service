import { db } from '../src/lib/db';
import { users } from '../src/lib/db/schema';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function seedAdmin() {
  const hashedPassword = '$2a$10$e9r9y86HCBQ0cUYV6qE0FexrRNq18sjKvF13kR2BpS0XgYIcDP9Ke';

  await db.insert(users).values({
    email: 'admin@caixaescolar.com.br',
    password: hashedPassword,
    name: 'Administrador',
  }).onConflictDoUpdate({
    target: users.email,
    set: { password: hashedPassword },
  });

  console.log('Admin seeded successfully!');
}

seedAdmin().catch(console.error);
