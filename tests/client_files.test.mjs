import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_FILE_BYTES, fileSizeError, selectCaseFiles } from '../src/lib/clientFiles.js';

const file = (name, size = 100) => ({ name, size });
test('empty and oversized documents are rejected, including the exact size boundary', () => {
  assert.ok(fileSizeError(file('empty.pdf', 0)));
  assert.ok(fileSizeError(file('large.pdf', MAX_FILE_BYTES + 1)));
  assert.equal(fileSizeError(file('limit.pdf', MAX_FILE_BYTES)), '');
});
test('an invalid first selection does not consume the last available slot', () => {
  const valid = file('complete-notification.pdf');
  const result = selectCaseFiles([file('large.pdf', MAX_FILE_BYTES + 1), valid], 4);
  assert.deepEqual(result.files, [valid]);
  assert.match(result.message, /12 MB/);
});
test('only available documents are added and overflow is explained', () => {
  const incoming = ['one.pdf', 'two.pdf', 'three.pdf'].map((name) => file(name));
  const result = selectCaseFiles(incoming, 3);
  assert.deepEqual(result.files, incoming.slice(0, 2));
  assert.match(result.message, /5 documentos/);
  assert.equal(selectCaseFiles(incoming, 5).files.length, 0);
});
test('each rejected reason is retained and no extra files are silently added', () => {
  const incoming = [file('empty.pdf', 0), file('large.pdf', MAX_FILE_BYTES + 1), file('a.pdf'), file('b.pdf')];
  const result = selectCaseFiles(incoming, 4);
  assert.deepEqual(result.files, [incoming[2]]);
  for (const text of ['vacíos', '12 MB', '5 documentos']) assert.ok(result.message.includes(text));
  assert.deepEqual(selectCaseFiles(null, 0), { files: [], message: '' });
});
