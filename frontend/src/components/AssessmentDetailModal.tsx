'use client';

import React, { useEffect, useRef } from 'react';
import { X, ShieldCheck, FileJson, Cpu, Hash, User, Lock, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { AssessmentRecord, MatchTriState } from '@/lib/genlayer';
import { handleModalKeyDown } from '@/lib/modalFocus';

interface AssessmentDetailModalProps {
  record: AssessmentRecord | null;
  onClose: () => void;
}

export const AssessmentDetailModal: React.FC<AssessmentDetailModalProps> = ({ record, onClose }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!record || !rootRef.current || !dialogRef.current) return;
    const root = rootRef.current;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = Array.from(root.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== root)
      .map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => { element.inert = true; });

    const handleKeyDown = (event: KeyboardEvent) => {
      const focusable = event.key === 'Tab'
        ? Array.from(dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ))
        : [];
      handleModalKeyDown(event, focusable, document.activeElement as HTMLElement | null, onClose);
    };

    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      background.forEach(({ element, inert }) => { element.inert = inert; });
      previousFocus?.focus();
    };
  }, [record, onClose]);

  if (!record) return null;

  const statusTone = record.status === 2 ? 'ok' : record.status === 4 ? 'err' : record.status === 1 ? 'pending' : 'warn';

  const renderTriStateBadge = (state: MatchTriState) => {
    if (state === 'EXACT') {
      return (
        <div className="ls-status ls-status--ok">
          <CheckCircle className="w-4 h-4" />
          EXACT
        </div>
      );
    } else if (state === 'MISMATCH') {
      return (
        <div className="ls-status ls-status--err">
          <XCircle className="w-4 h-4" />
          MISMATCH
        </div>
      );
    }
    return (
      <div className="ls-status ls-status--warn">
        <HelpCircle className="w-4 h-4" />
        NOT EVALUATED
      </div>
    );
  };

  return (
    <div ref={rootRef} className="ls-modal-root" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className="ls-modal" role="dialog" aria-modal="true" aria-labelledby="assessment-detail-title">
        <div className="ls-modal__head">
          <div className="min-w-0">
            <h3 id="assessment-detail-title" className="ls-modal__title flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
              Assessment #{record.assessment_id} Evidence &amp; Verdict
            </h3>
            <p className="ls-modal__key">{record.canonical_key}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="ls-icon-btn shrink-0"
            aria-label="Close assessment details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="ls-modal__body">
          <div className="ls-alert ls-alert--info justify-between flex-wrap">
            <div className="ls-alert__body">
              <span className="text-[10px] text-[var(--color-muted)]">Consensus verdict</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`ls-badge ls-badge--${statusTone}`}>
                  {record.status_name}
                </span>
                <span className="ls-badge ls-badge--neutral">
                  {record.reason_code || 'PENDING_RESOLUTION'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[var(--color-muted)]">Retry count</span>
              <div>{record.retry_count} / 2 retries</div>
            </div>
          </div>

          <div className="ls-codeblock">
            <div>POLICY MANIFEST VERSION: <span className="cmd">{record.policy_version}</span></div>
            <div className="break-all">MANIFEST HASH: {record.policy_hash}</div>
          </div>

          <div className="ls-matrix">
            <div className="ls-matrix__cell">
              <span className="ls-matrix__label">Subject identity</span>
              {renderTriStateBadge(record.subject_match)}
            </div>

            <div className="ls-matrix__cell">
              <span className="ls-matrix__label">Revision SHA</span>
              {renderTriStateBadge(record.revision_match)}
            </div>

            <div className="ls-matrix__cell">
              <span className="ls-matrix__label">Evidence sufficiency</span>
              <div className={`ls-status ${record.evidence_sufficient ? 'ls-status--ok' : 'ls-status--warn'} justify-center`}>
                {record.evidence_sufficient ? (
                  <><CheckCircle className="w-4 h-4" /> SUFFICIENT</>
                ) : (
                  <><HelpCircle className="w-4 h-4" /> INSUFFICIENT</>
                )}
              </div>
            </div>
          </div>

          <div className="ls-kv">
            <div className="ls-kv__item">
              <span className="ls-kv__label">Identified license IDs</span>
              {record.license_ids && record.license_ids.length > 0 ? (
                <div className="ls-chip-row">
                  {record.license_ids.map((lic, idx) => (
                    <span key={idx} className="ls-chip ls-chip--ok">
                      {lic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="ls-kv__value">None identified</p>
              )}
            </div>

            <div className="ls-kv__item">
              <span className="ls-kv__label">Operational obligations</span>
              {record.obligations && record.obligations.length > 0 ? (
                <div className="ls-chip-row">
                  {record.obligations.map((obl, idx) => (
                    <span key={idx} className="ls-chip ls-chip--accent">
                      {obl}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="ls-kv__value">None required</p>
              )}
            </div>
          </div>

          <div className="ls-kv">
            <div className="ls-kv__item">
              <span className="ls-kv__label">
                <Cpu className="w-3.5 h-3.5" />
                Artifact & Kind
              </span>
              <p className="ls-kv__value">
                {record.artifact_kind}: {record.namespace}/{record.name}
              </p>
            </div>

            <div className="ls-kv__item">
              <span className="ls-kv__label">
                <Lock className="w-3.5 h-3.5" />
                Intended Use Profile
              </span>
              <p className="ls-kv__value">{record.use_profile}</p>
            </div>

            <div className="ls-kv__item ls-kv__item--span">
              <span className="ls-kv__label">
                <Hash className="w-3.5 h-3.5" />
                Immutable Commit SHA
              </span>
              <p className="ls-kv__value ls-kv__value--mono">{record.revision}</p>
            </div>

            <div className="ls-kv__item ls-kv__item--span">
              <span className="ls-kv__label">
                <User className="w-3.5 h-3.5" />
                Requester Address
              </span>
              <p className="ls-kv__value ls-kv__value--mono">{record.requester}</p>
            </div>
          </div>

          <div className="ls-kv__item">
            <span className="ls-kv__label">Contract verdict summary</span>
            <p className="ls-kv__value font-normal leading-relaxed">{record.explanation}</p>
          </div>

          <div>
            <h4 className="ls-doc__h flex items-center gap-2">
              <FileJson className="w-4 h-4 text-[var(--color-accent)]" />
              Verified Evidence References
            </h4>
            <div className="ls-evidence-list">
              {record.evidence_references && record.evidence_references.length > 0 ? (
                record.evidence_references.map((ref, idx) => (
                  <div key={idx} className="ls-evidence-item">
                    {ref}
                  </div>
                ))
              ) : (
                <div className="ls-evidence-item">No external evidence URLs attached.</div>
              )}
            </div>
          </div>
        </div>

        <div className="ls-modal__foot">
          <button
            onClick={onClose}
            className="ls-btn ls-btn--secondary"
          >
            Close Evidence Window
          </button>
        </div>
      </div>
    </div>
  );
};
