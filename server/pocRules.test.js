import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMarks, canTransition, canApprove, validateDocumentDecision, validUploadMetadata } from './pocRules.js';

for (const [value, expectedStatus, expectedMarks] of [
  ['49', 422], ['49.99', 422], ['0', 422], ['50', undefined, 50], ['51', undefined, 51],
  [100, undefined, 100], ['85.5', undefined, 85.5], ['.5', 422],
  ['101', 400], [-1, 400], ['50abc', 400], ['abc', 400], ['', 400], [' ', 400],
  ['1e2', 400], [null, 400], [undefined, 400], [{ $gt: 0 }, 400],
]) {
  test('marks ' + JSON.stringify(value) + ' validated', () => {
    const result = validateMarks(value);
    if (expectedStatus) {
      assert.equal(result.ok, false);
      assert.equal(result.status, expectedStatus);
    } else {
      assert.equal(result.ok, true);
      assert.equal(result.marks, expectedMarks);
    }
  });
}
for (const [a, b, allowed] of [
  ['Submitted', 'Under Review', true], ['Submitted', 'Rejected', true], ['Submitted', 'Approved', false],
  ['Under Review', 'Approved', true], ['Under Review', 'Rejected', true], ['Under Review', 'Submitted', false],
  ['Approved', 'Rejected', false], ['Rejected', 'Approved', false], ['Approved', 'Approved', false],
]) {
  test(a + ' -> ' + b + ': ' + allowed, () => assert.equal(canTransition(a, b), allowed));
}
const valid = { feeStatus: 'Paid', docs: ['A', 'B', 'C'].map(x => ({ label: x, status: 'Verified', fileName: x })) };
test('approve when all three documents and fee are confirmed', () => assert.equal(canApprove(valid), true));
test('block approval without fee', () => assert.equal(canApprove({ ...valid, feeStatus: 'Pending' }), false));
test('block approval with a pending file', () => assert.equal(canApprove({ ...valid, docs: [{ status: 'Pending' }, ...valid.docs.slice(1)] }), false));
test('block approval without file reference', () => assert.equal(canApprove({ ...valid, docs: [{ status: 'Verified' }, ...valid.docs.slice(1)] }), false));
test('block approval without documents', () => assert.equal(canApprove({ ...valid, docs: [] }), false));
test('reject document without reason', () => assert.equal(validateDocumentDecision('Rejected', ' ').status, 400));
test('reject invalid document state', () => assert.equal(validateDocumentDecision('Other', '').status, 400));
test('allow rejected document with explanation', () => assert.equal(validateDocumentDecision('Rejected', 'Unreadable').ok, true));
test('allow PDF metadata', () => assert.equal(validUploadMetadata({ originalname: 'mark.pdf', mimetype: 'application/pdf' }), true));
test('reject PDF extension with JPEG MIME', () => assert.equal(validUploadMetadata({ originalname: 'mark.pdf', mimetype: 'image/jpeg' }), false));
test('reject executable extension', () => assert.equal(validUploadMetadata({ originalname: 'mark.exe', mimetype: 'application/pdf' }), false));
