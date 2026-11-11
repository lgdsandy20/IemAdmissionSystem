// replaces client/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiUpload } from '../api';

const steps = ['Submitted', 'Docs Verified', 'Under Review', 'Decision'];

type Doc = { label: string; fileName?: string; status: 'Pending' | 'Verified' | 'Rejected'; reason?: string };
type Application = {
  appId: string;
  applicantName: string;
  course: string;
  campus: string;
  docs: Doc[];
  feeStatus: 'Pending' | 'Paid';
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
};

function getCurrentStep(app: Application) {
  if (app.status === 'Approved' || app.status === 'Rejected') {
    return 3;
  }
  if (app.status === 'Under Review') {
    return 2;
  }
  const allVerified = app.docs.every(d => d.status === 'Verified');
  if (allVerified) {
    return 1;
  }
  return 0;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDocs, setShowDocs] = useState(false);

  async function load() {
    try {
      const data = await api('/applications/mine');
      setApp(data);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'Not logged in' || msg === 'Forbidden') {
        localStorage.removeItem('token');
        navigate('/');
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function payFee() {
    if (!app) {
      return;
    }
    try {
      const updated = await api(`/applications/${app.appId}/pay`, 'POST');
      setApp(updated);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function reupload(index: number, file: File | undefined) {
    if (!app || !file) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File is over 5 MB');
      return;
    }
    try {
      const updated = await apiUpload(`/applications/${app.appId}/docs/${index}`, file);
      setApp(updated);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    navigate('/');
  }

  if (loading) {
    return <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center text-sm text-gray-500">Loading...</div>;
  }

  const verified = app ? app.docs.filter(d => d.status === 'Verified').length : 0;
  const pending = app ? app.docs.filter(d => d.status === 'Pending').length : 0;
  const rejected = app ? app.docs.filter(d => d.status === 'Rejected').length : 0;
  const currentStep = app ? getCurrentStep(app) : 0;

  return (
    <div className="min-h-screen bg-[#f4f5f7] px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-4 px-1">
          <span className="text-xs font-mono tracking-widest text-gray-400 uppercase">Screen 2 of 4</span>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-sm">
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <span className="ml-3 text-xs text-gray-400 font-medium">2. Applicant Dashboard</span>
          </div>

          <div className="p-6 space-y-5">
            {error && <p className="text-sm text-red-600">{error}</p>}

            {!app && (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-gray-600">You have not submitted an application yet.</p>
                <button
                  onClick={() => navigate('/apply')}
                  className="bg-[#1b2f5e] text-white text-sm font-semibold px-6 py-3 hover:bg-[#111e3d] transition-colors"
                >
                  Start Application
                </button>
              </div>
            )}

            {app && (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1b2f5e]">Welcome, {app.applicantName}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{app.course} · {app.campus}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">App ID:</span>
                    <span className="text-xs font-mono font-semibold text-gray-600 ml-1">{app.appId}</span>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-4">
                    Application status timeline
                    {app.status === 'Approved' && <span className="ml-2 text-xs font-semibold text-green-600">Approved ✓</span>}
                    {app.status === 'Rejected' && <span className="ml-2 text-xs font-semibold text-red-600">Rejected ✗</span>}
                  </p>
                  <div className="flex items-center">
                    {steps.map((step, i) => (
                      <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                            i <= currentStep ? 'bg-[#1b2f5e] border-[#1b2f5e] text-white' : 'bg-white border-gray-300 text-gray-400'
                          }`}>
                            {i <= currentStep ? '✓' : ''}
                          </div>
                          <span className="text-[10px] text-gray-500 mt-1.5 whitespace-nowrap">{step}</span>
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < currentStep ? 'bg-[#1b2f5e]' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Documents card */}
                <div className="border border-gray-200 rounded-sm p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Documents</p>
                      <p className="text-xs text-gray-500 mt-0.5">{verified} Verified · {pending} Pending · {rejected} Rejected</p>
                    </div>
                    <button
                      onClick={() => setShowDocs(s => !s)}
                      className="border-2 border-[#1b2f5e] text-[#1b2f5e] text-sm font-semibold px-4 py-2 hover:bg-[#1b2f5e] hover:text-white transition-colors"
                    >
                      {showDocs ? 'Hide Docs' : 'View Docs'}
                    </button>
                  </div>

                  {showDocs && (
                    <div className="mt-4 space-y-2">
                      {app.docs.map((doc, i) => (
                        <div key={doc.label} className="border border-gray-100 bg-gray-50 rounded-sm px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">{doc.label}</span>
                            <span className={`text-xs font-medium ${
                              doc.status === 'Verified' ? 'text-green-600' : doc.status === 'Rejected' ? 'text-red-600' : 'text-amber-600'
                            }`}>{doc.status}</span>
                          </div>
                          {(doc.status === 'Rejected' || !doc.fileName) && app.status !== 'Approved' && app.status !== 'Rejected' && (
                            <div className="mt-2 text-xs text-red-600">
                              {doc.status === 'Rejected' ? `Reason: ${doc.reason}` : 'Document not uploaded yet'}
                              <label className="ml-3 underline cursor-pointer text-[#1b2f5e]">
                                {doc.fileName ? 'Re-upload' : 'Upload'}
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.pdf"
                                  className="hidden"
                                  onChange={e => reupload(i, e.target.files?.[0])}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fee card */}
                <div className="border border-gray-200 rounded-sm p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Fee payment</p>
                    <p className="text-xs text-gray-500 mt-0.5">Application fee: {app.feeStatus}</p>
                  </div>
                  {app.feeStatus === 'Pending' && (
                    <button onClick={payFee} className="bg-[#1b2f5e] text-white text-sm font-semibold px-4 py-2 hover:bg-[#111e3d] transition-colors">
                      Pay Fee
                    </button>
                  )}
                  {app.feeStatus === 'Paid' && <span className="text-xs font-semibold text-green-600">Paid ✓</span>}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => window.print()}
                    disabled={app.feeStatus !== 'Paid'}
                    className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-3 hover:border-gray-500 hover:text-gray-900 transition-colors disabled:opacity-40"
                  >
                    Download Receipt
                  </button>
                </div>

                <p className="text-center text-xs text-gray-400">
                  Timeline stays read-only once the form is submitted
                </p>
              </>
            )}

            <div className="pt-2 border-t border-gray-100">
              <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                ← Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
