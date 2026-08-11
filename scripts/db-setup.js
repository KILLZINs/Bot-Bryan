#!/usr/bin/env node
// Runs before prisma db push to fix legacy constraint issues
const { execSync } = require('child_process');

const fixes = [
  // Old schema had achievements.name as @unique — must drop constraint (not just index) before prisma can replace it with @@unique([memberId, name])
  'ALTER TABLE IF EXISTS achievements DROP CONSTRAINT IF EXISTS achievements_name_key;',
  // Also drop the composite index in case it exists already in a broken state
  'DROP INDEX IF EXISTS achievements_member_id_name_key;',
];

for (const sql of fixes) {
  try {
    execSync(
      `echo "${sql}" | prisma db execute --stdin --schema=prisma/schema.prisma`,
      { stdio: 'inherit', shell: true }
    );
  } catch (e) {
    // Table may not exist yet on first deploy — safe to ignore
    console.log('Pre-push step skipped (safe):', e.message?.split('\n')[0]);
  }
}

// Now run the actual schema push
execSync('prisma db push --accept-data-loss', { stdio: 'inherit' });
