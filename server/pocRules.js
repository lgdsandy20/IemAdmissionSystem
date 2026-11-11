// Pure rules stay independent of Express/Mongoose so boundary cases are easy to test.
export const MIN_MARKS = 50;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export function validateMarks(value) {
  // parseFloat('50abc') returns 50; reject partially numeric input instead.
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!text || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    return { ok: false, status: 400, error: 'Invalid marks: enter a number from 0 to 100' };
  }
  const marks = Number(text);
  if (!Number.isFinite(marks) || marks < 0 || marks > 100) {
    return { ok: false, status: 400, error: 'Invalid marks: enter a number from 0 to 100' };
  }
  if (marks < MIN_MARKS) return { ok: false, status: 422, error: 'Not eligible' };
  return { ok: true, marks };
}
const TRANSITIONS = {
  Submitted: ['Under Review', 'Rejected'],
  'Under Review': ['Approved', 'Rejected'],
  Approved: [],
  Rejected: [],
};
export function canTransition(current, target) {
  // The API—not a disabled frontend button—decides whether a transition is valid.
  return Array.isArray(TRANSITIONS[current]) && TRANSITIONS[current].includes(target);
}
export function canApprove(application) {
  return application.feeStatus === 'Paid' &&
    Array.isArray(application.docs) && application.docs.length === 3 &&
    application.docs.every(doc => doc.status === 'Verified' && Boolean(doc.fileName));
}
export function validateDocumentDecision(status, reason) {
  if (status !== 'Verified' && status !== 'Rejected') {
    return { ok: false, status: 400, error: 'Invalid document decision' };
  }
  if (status === 'Rejected' && (typeof reason !== 'string' || !reason.trim())) {
    return { ok: false, status: 400, error: 'Rejection reason is mandatory' };
  }
  return { ok: true };
}
export function validUploadMetadata(file) {
  if (!file || typeof file.originalname !== 'string') return false;
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  const allowed = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
  // Filename and declared MIME are checked; production needs magic-byte and malware scanning.
  return Object.hasOwn(allowed, ext) && allowed[ext] === file.mimetype;
}
