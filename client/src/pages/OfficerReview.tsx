// replaces client/src/pages/OfficerReview.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../api';

type Doc = { label: string; fileName?: string; status: 'Pending' | 'Verified' | 'Rejected'; reason?: string };
type Application = {
  appId: string;
  applicantName: string;
  course: string;
  campus: string;
  marks: number;
  docs: Doc[];
  feeStatus: 'Pending' | 'Paid';
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
};

function statusLabel(app: Application) {
  const allVerified = app.docs.every(d => d.status === 'Verified');
  if (app.status === 'Submitted' && allVerified) {
    return 'Docs Verified';
  }
  return app.status;
}

function badgeClass(label: string) {
  if (label === 'Docs Verified' || label === 'Approved') {
    return 'bg-green-100 text-green-700';
  }
  if (label === 'Under Review') {
    return 'bg-blue-100 text-blue-700';
  }
  if (label === 'Rejected') {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-gray-100 text-gray-600';
}

export default function OfficerReview() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const selected = apps.find(a => a.appId === selectedId) || null;

  function handleError(err: unknown) {
    const msg = (err as Error).message;
    if (msg === 'Not logged in' || msg === 'Forbidden') {
      localStorage.removeItem('token');
      navigate('/');
      return;
    }
    setError(msg);
  }

  async function load(q: string) {
    try {
      const list = await api('/officer/applications?q=' + encodeURIComponent(q));
      setApps(list);
      if (list.length > 0 && !list.some((a: Application) => a.appId === selectedId)) {
        setSelectedId(list[0].appId);
      }
      if (list.length === 0) {
        setSelectedId(null);
      }
    } catch (err) {
      handleError(err);
    }
  }

  useEffect(() => {
    load('');
  }, []);

  // replace one application in the list with the updated copy from the server
  function replaceApp(updated: Application) {
    setApps(list => list.map(a => (a.appId === updated.appId ? updated : a)));
  }

  async function setDocStatus(index: number, status: 'Verified' | 'Rejected') {
    if (!selected) {
      return;
    }
    let reason = '';
    if (status === 'Rejected') {
      const typed = window.prompt('Reason for rejection (required):');
      if (!typed) {
        return;
      }
      reason = typed;
    }
    try {
      const updated = await api(`/officer/applications/${selected.appId}/docs/${index}`, 'PATCH', { status, reason });
      replaceApp(updated);
      setError('');
    } catch (err) {
      handleError(err);
    }
  }

  async function decide(decision: 'Approved' | 'Rejected') {
    if (!selected) {
      return;
    }
    try {
      const updated = await api(`/officer/applications/${selected.appId}/decision`, 'PATCH', { decision });
      replaceApp(updated);
      setError('');
    } catch (err) {
      handleError(err);
    }
  }

  async function viewFile(fileName: string | undefined) {
    if (!fileName) {
      setError('No file uploaded for this document');
      return;
    }
    // open the tab first so the popup blocker allows it, then point it at the file
    const tab = window.open('', '_blank');
    const token = localStorage.getItem('token');
    const res = await fetch(API_BASE + '/officer/files/' + encodeURIComponent(fileName), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (tab) {
        tab.close();
      }
      setError('Could not open file');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    }
  }

  function logout() {
    localStorage.removeItem('token');
    navigate('/');
  }

  const decided = selected && (selected.status === 'Approved' || selected.status === 'Rejected');

  return (
    <div className="min-h-screen bg-[#f4f5f7] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 px-1">
          <span className="text-xs font-mono tracking-widest text-gray-400 uppercase">Screen 4 of 4</span>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-sm">
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <span className="ml-3 text-xs text-gray-400 font-medium">4. Officer / Admin — Review Application</span>
          </div>

          <div className="p-6 space-y-5">
            {/* Search */}
            <form
              className="flex gap-2"
              onSubmit={e => {
                e.preventDefault();
                load(query);
              }}
            >
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by Application ID / name / course"
                className="flex-1 border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#1b2f5e] focus:ring-1 focus:ring-[#1b2f5e]"
              />
              <button type="submit" className="bg-[#1b2f5e] text-white text-sm font-semibold px-5 py-2 hover:bg-[#111e3d] transition-colors">
                Search
              </button>
            </form>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* Applications table */}
            <div className="border border-gray-200 rounded-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['App ID', 'Applicant', 'Course', 'Status'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apps.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-400">No applications found</td>
                    </tr>
                  )}
                  {apps.map(a => {
                    const label = statusLabel(a);
                    return (
                      <tr
                        key={a.appId}
                        onClick={() => setSelectedId(a.appId)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${selectedId === a.appId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{a.appId}</td>
                        <td className="px-3 py-2 text-gray-800">{a.applicantName}</td>
                        <td className="px-3 py-2 text-gray-600">{a.course}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass(label)}`}>{label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Selected application */}
            {selected && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">
                  Selected application
                  <span className="ml-2 text-xs font-normal text-gray-400 font-mono">{selected.appId} — {selected.applicantName}</span>
                </p>

                <div className="space-y-2">
                  {selected.docs.map((doc, i) => (
                    <div key={doc.label}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 border border-gray-200 bg-gray-50 rounded-sm px-3 py-2 text-sm text-gray-600">
                          {doc.label}
                          <span className={`ml-2 text-xs font-medium ${
                            doc.status === 'Verified' ? 'text-green-600' : doc.status === 'Rejected' ? 'text-red-600' : 'text-amber-600'
                          }`}>· {doc.status}</span>
                          <button onClick={() => viewFile(doc.fileName)} className="ml-3 text-xs text-[#2563eb] underline">
                            View file
                          </button>
                        </div>
                        <button
                          onClick={() => setDocStatus(i, 'Verified')}
                          disabled={!!decided}
                          className="bg-[#1b2f5e] text-white text-xs font-semibold px-3 py-2 hover:bg-[#111e3d] transition-colors disabled:opacity-40"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => setDocStatus(i, 'Rejected')}
                          disabled={!!decided}
                          className="border border-gray-300 text-gray-600 text-xs font-medium px-3 py-2 hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          Reject + reason
                        </button>
                      </div>
                      {doc.status === 'Rejected' && doc.reason && (
                        <p className="text-xs text-red-600 mt-1 ml-1">Reason: {doc.reason}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-6 mt-4 text-xs font-semibold">
                  <span className={selected.feeStatus === 'Paid' ? 'text-green-600' : 'text-amber-600'}>
                    Fee: {selected.feeStatus}{selected.feeStatus === 'Paid' ? ' ✓' : ''}
                  </span>
                  <span className="text-gray-500">Seat availability: Not implemented (POC)</span>
                  <span className="text-gray-500">Marks: {selected.marks}%</span>
                </div>
              </div>
            )}

            {/* Approve / Reject */}
            {selected && decided && (
              <div className={`text-center py-4 font-semibold text-sm rounded-sm ${
                selected.status === 'Approved' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                Application {selected.status === 'Approved' ? 'Approved ✓' : 'Rejected ✗'}
              </div>
            )}
            {selected && !decided && (
              <div className="flex gap-3">
                <button
                  onClick={() => decide('Approved')}
                  className="flex-1 bg-[#1b2f5e] text-white text-sm font-semibold py-3 tracking-wide hover:bg-[#111e3d] uppercase transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide('Rejected')}
                  className="flex-1 border-2 border-red-500 text-red-600 text-sm font-semibold py-3 tracking-wide hover:bg-red-50 uppercase transition-colors"
                >
                  Reject
                </button>
              </div>
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
