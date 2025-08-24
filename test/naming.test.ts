import { generateUserVariantFilename } from '../src/utils/naming';

function assertEquals(actual: string, expected: string, context: string) {
  if (actual !== expected) {
    throw new Error(`${context}: expected '${expected}', got '${actual}'`);
  }
}

async function run(){
  const existing = new Set(['user.file.md','user.0.file.md','user.1.file.md']);
  const next = generateUserVariantFilename('file.md', existing);
  assertEquals(next, 'user.2.file.md', 'Next variant filename');
  
  const fresh = generateUserVariantFilename('another.md', new Set());
  assertEquals(fresh, 'user.another.md', 'Fresh filename');
  
  const already = generateUserVariantFilename('user.existing.md', new Set(['user.existing.md']));
  assertEquals(already, 'user.0.user.existing.md', 'Already existing filename');
  
  console.log('naming.test OK');
}
run().catch(e=>{ console.error('naming.test FAIL', e); process.exit(1); });
