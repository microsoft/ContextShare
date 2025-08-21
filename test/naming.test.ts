import { generateUserVariantFilename } from '../src/utils/naming';

async function run(){
  const existing = new Set(['user.file.md','user.0.file.md','user.1.file.md']);
  const next = generateUserVariantFilename('file.md', existing);
  if(next !== 'user.2.file.md') throw new Error('Expected user.2.file.md got '+next);
  const fresh = generateUserVariantFilename('another.md', new Set());
  if(fresh !== 'user.another.md') throw new Error('Expected user.another.md got '+fresh);
  const already = generateUserVariantFilename('user.existing.md', new Set(['user.existing.md']));
  if(already !== 'user.0.user.existing.md') throw new Error('Expected user.0.user.existing.md got '+already);
  console.log('naming.test OK');
}
run().catch(e=>{ console.error('naming.test FAIL', e); process.exit(1); });
