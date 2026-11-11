// replaces client/src/pages/ApplicationForm.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiUpload } from '../api';

const DOCS = [
  { label: 'Mark sheet', key: 'marksheet' },
  { label: 'ID proof', key: 'idProof' },
  { label: 'Photo', key: 'photo' },
];
const MAX_SIZE = 5 * 1024 * 1024;

export default function ApplicationForm() {
  const navigate = useNavigate();
  const [course, setCourse] = useState('');
  const [campus, setCampus] = useState('');
  const [qualification, setQualification] = useState('');
  const [marks, setMarks] = useState('');
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({ marksheet: null, idProof: null, photo: null });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  function checkEligibility() {
    const pct = Number(marks);
    // User-facing feedback mirrors the rule; server remains the source of truth.
    setEligible(marks.trim() !== '' && Number.isFinite(pct) && pct >= 50 && pct <= 100);
  }

  function pickFile(key: string, file: File | undefined) {
    if (!file) {
      return;
    }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      setError('Only JPEG, PNG and PDF documents are allowed');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File is over 5 MB: ' + file.name);
      return;
    }
    setError('');
    setFiles(f => ({ ...f, [key]: file }));
  }

  async function handleSubmit() {
    setError('');
    if (!course || !campus || !marks) {
      setError('Please fill course, campus and marks');
      return;
    }
    for (const d of DOCS) {
      if (!files[d.key]) {
        setError('Please upload: ' + d.label);
        return;
      }
    }
    setBusy(true);
    // Preserve the newly created ID if a later upload fails: retry must not create a duplicate.
    let savedId = createdId;
    try {
      // 1. create the application (server checks eligibility, makes the APP ID)
      const created = savedId ? { appId: savedId } : await api('/applications', 'POST', { course, campus, qualification, marks });
      savedId = created.appId;
      setCreatedId(created.appId);
      // 2. upload the 3 documents (index matches the server's docs array)
      for (let i = 0; i < DOCS.length; i++) {
        await apiUpload(`/applications/${created.appId}/docs/${i}`, files[DOCS[i].key] as File);
      }
      // 3. sandbox payment
      await api(`/applications/${created.appId}/pay`, 'POST');
      navigate('/dashboard');
    } catch (err) {
      setError((savedId ? 'Application saved; retry the uploads or finish from your dashboard. ' : '') + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = 'w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#1b2f5e] focus:ring-1 focus:ring-[#1b2f5e]';

  return (
    <div className="min-h-screen bg-[#f4f5f7] px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-4 px-1">
          <span className="text-xs font-mono tracking-widest text-gray-400 uppercase">Screen 3 of 4</span>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-sm">
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <span className="ml-3 text-xs text-gray-400 font-medium">3. Application Form &amp; Documents</span>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Course</label>
                <select value={course} onChange={e => setCourse(e.target.value)} className={field + ' bg-white'}>
                  <option value=""></option>
                  <option>B.Tech CSE</option>
                  <option>B.Tech ECE</option>
                  <option>B.Tech ME</option>
                  <option>MBA</option>
                  <option>MCA</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Campus</label>
                <select value={campus} onChange={e => setCampus(e.target.value)} className={field + ' bg-white'}>
                  <option value=""></option>
                  <option>Kolkata Main</option>
                  <option>Salt Lake</option>
                  <option>Gurugram</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Highest qualification</label>
                <input type="text" value={qualification} onChange={e => setQualification(e.target.value)} placeholder="e.g. 12th / Diploma" className={field} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Marks (%)</label>
                <div className="flex gap-2">
                  <input type="number" min="0" max="100" step="any" value={marks} onChange={e => { setMarks(e.target.value); setEligible(null); }} onBlur={checkEligibility} placeholder="0–100" className={'flex-1 ' + field} />
                  <button
                    type="button"
                    onClick={checkEligibility}
                    className={`px-3 py-2 text-xs font-semibold border rounded-sm transition-colors ${
                      eligible === true ? 'bg-green-600 border-green-600 text-white'
                      : eligible === false ? 'bg-red-100 border-red-400 text-red-700'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-gray-500'
                    }`}
                  >
                    {eligible === true ? 'Eligible' : eligible === false ? 'Ineligible' : 'Check'}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-800 mb-3">
                Upload documents <span className="text-xs font-normal text-gray-400">(JPEG / PNG / PDF, max 5 MB)</span>
              </p>
              <div className="space-y-2">
                {DOCS.map(({ label, key }) => (
                  <div key={key} className="flex gap-2 items-center">
                    <div className={`flex-1 border border-gray-200 bg-gray-50 rounded-sm px-3 py-2 text-sm truncate ${files[key] ? 'text-gray-800' : 'text-gray-400'}`}>
                      {files[key] ? files[key]!.name : label}
                    </div>
                    <label className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-sm hover:border-gray-500 hover:text-gray-900 transition-colors cursor-pointer">
                      Upload
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                        onChange={e => pickFile(key, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-3 hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="flex-1 bg-[#1b2f5e] text-white text-sm font-semibold py-3 tracking-wide hover:bg-[#111e3d] transition-colors uppercase disabled:opacity-50"
              >
                {busy ? 'Submitting...' : 'Submit & Pay Fee'}
              </button>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
