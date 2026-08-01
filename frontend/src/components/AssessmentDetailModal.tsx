'use client';

import React from 'react';
import { X, ShieldCheck, FileJson, Cpu, Hash, User, Lock, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { AssessmentRecord, STATUS_MAP, MatchTriState } from '@/lib/genlayer';

interface AssessmentDetailModalProps {
  record: AssessmentRecord | null;
  onClose: () => void;
}

export const AssessmentDetailModal: React.FC<AssessmentDetailModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const statusMeta = STATUS_MAP[record.status] || {
    name: record.status_name,
    badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  const renderTriStateBadge = (state: MatchTriState) => {
    if (state === 'EXACT') {
      return (
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-300">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          EXACT
        </div>
      );
    } else if (state === 'MISMATCH') {
      return (
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-300">
          <XCircle className="w-4 h-4 text-rose-400" />
          MISMATCH
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-300">
        <HelpCircle className="w-4 h-4 text-amber-400" />
        NOT EVALUATED
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/50 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Assessment #{record.assessment_id} Evidence & Verdict
              </h3>
              <p className="text-[11px] text-slate-400 font-mono break-all">{record.canonical_key}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Status Header Banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Consensus Verdict</span>
              <div className="mt-1 flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.badgeClass}`}>
                  {record.status_name}
                </span>
                <span className="text-xs font-mono text-cyan-300 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">
                  {record.reason_code || 'PENDING_RESOLUTION'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">Retry Count</span>
              <div className="text-xs font-mono text-slate-300 mt-1">{record.retry_count} / 2 retries</div>
            </div>
          </div>

          {/* Policy Version & Hash from Contract */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>POLICY MANIFEST VERSION: <span className="text-cyan-300 font-bold">{record.policy_version}</span></span>
            </div>
            <div className="text-slate-500 text-[10px] break-all">
              MANIFEST HASH: <span className="text-slate-300">{record.policy_hash}</span>
            </div>
          </div>

          {/* Substantive Tri-State Validation Matrix */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1">Subject Identity</span>
              {renderTriStateBadge(record.subject_match)}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1">Revision SHA</span>
              {renderTriStateBadge(record.revision_match)}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1">Evidence Sufficiency</span>
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                {record.evidence_sufficient ? (
                  <><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-emerald-300 font-bold">SUFFICIENT</span></>
                ) : (
                  <><HelpCircle className="w-4 h-4 text-amber-400" /><span className="text-amber-300 font-bold">INSUFFICIENT</span></>
                )}
              </div>
            </div>
          </div>

          {/* License IDs & Obligations Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider block">Identified License IDs</span>
              {record.license_ids && record.license_ids.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {record.license_ids.map((lic, idx) => (
                    <span key={idx} className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded font-mono text-[11px]">
                      {lic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-[11px] italic">None identified</p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider block">Operational Obligations</span>
              {record.obligations && record.obligations.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {record.obligations.map((obl, idx) => (
                    <span key={idx} className="bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded font-mono text-[11px]">
                      {obl}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-[11px] italic">None required</p>
              )}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Artifact & Kind
              </span>
              <p className="font-semibold text-slate-200">
                {record.artifact_kind}: {record.namespace}/{record.name}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                Intended Use Profile
              </span>
              <p className="font-semibold text-slate-200">{record.use_profile}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 sm:col-span-2">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                Immutable Commit SHA
              </span>
              <p className="font-mono text-cyan-400 text-[11px] break-all">{record.revision}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 sm:col-span-2">
              <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                <User className="w-3.5 h-3.5 text-amber-400" />
                Requester Address
              </span>
              <p className="font-mono text-slate-300 text-[11px] break-all">{record.requester}</p>
            </div>
          </div>

          {/* Explanation */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Contract Verdict Summary</span>
            <p className="text-slate-200 leading-relaxed mt-1">{record.explanation}</p>
          </div>

          {/* Evidence References */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <FileJson className="w-4 h-4 text-cyan-400" />
              Verified Evidence References
            </h4>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              {record.evidence_references && record.evidence_references.length > 0 ? (
                record.evidence_references.map((ref, idx) => (
                  <div key={idx} className="font-mono text-[11px] text-cyan-300 break-all bg-slate-900/60 px-3 py-1.5 rounded border border-slate-800">
                    {ref}
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-slate-500 italic">No external evidence URLs attached.</div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close Evidence Window
          </button>
        </div>
      </div>
    </div>
  );
};
