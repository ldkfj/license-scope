'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { ContractStatusBanner } from '@/components/ContractStatusBanner';
import { RequestAssessmentForm } from '@/components/RequestAssessmentForm';
import { AssessmentList } from '@/components/AssessmentList';
import { AssessmentDetailModal } from '@/components/AssessmentDetailModal';
import { SecuritySection } from '@/components/SecuritySection';
import {
  AssessmentRecord,
  isContractConfigured,
  getClient,
  CONTRACT_ADDRESS,
  parseAssessmentRecord,
  formatRegistryReadError,
} from '@/lib/genlayer';
import { TransactionCoordinatorProvider } from '@/lib/transactionCoordinator';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'request' | 'registry' | 'security'>('request');
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AssessmentRecord | null>(null);
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(false);
  const [assessmentLoadError, setAssessmentLoadError] = useState<string | null>(null);

  const isConfigured = isContractConfigured();
  const closeSelectedRecord = useCallback(() => setSelectedRecord(null), []);

  const fetchAssessmentCountAndRecords = useCallback(async (): Promise<void> => {
    if (!isConfigured) return;

    setIsLoadingAssessments(true);
    setAssessmentLoadError(null);
    try {
      const client = getClient();
      const countBigInt = (await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'get_assessment_count',
        args: [],
      })) as bigint;

      const count = Number(countBigInt);
      const fetched: AssessmentRecord[] = [];

      for (let i = 1; i <= count; i++) {
        const raw = (await client.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'get_assessment',
          args: [BigInt(i)],
        })) as Record<string, unknown>;

        fetched.push(parseAssessmentRecord(raw));
      }

      setAssessments(fetched.reverse());
    } catch (err) {
      console.error('Failed fetching assessment records:', err);
      setAssessmentLoadError(formatRegistryReadError(err));
    } finally {
      setIsLoadingAssessments(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    let isMounted = true;
    if (isConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAssessmentCountAndRecords().then(() => {
        if (!isMounted) return;
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isConfigured, fetchAssessmentCountAndRecords]);

  return (
    <TransactionCoordinatorProvider contractAddress={CONTRACT_ADDRESS}>
    <div className="ls-app">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="ls-main">
        <ContractStatusBanner />

        {activeTab === 'request' && (
          <div className="flex flex-col gap-[var(--space-md)] min-w-0">
            <RequestAssessmentForm onTransactionSuccess={fetchAssessmentCountAndRecords} />
            <AssessmentList
              assessments={assessments}
              onSelectRecord={setSelectedRecord}
              onRefresh={fetchAssessmentCountAndRecords}
              isLoading={isLoadingAssessments}
              loadError={assessmentLoadError}
            />
          </div>
        )}

        {activeTab === 'registry' && (
          <AssessmentList
            assessments={assessments}
            onSelectRecord={setSelectedRecord}
            onRefresh={fetchAssessmentCountAndRecords}
            isLoading={isLoadingAssessments}
            loadError={assessmentLoadError}
          />
        )}

        {activeTab === 'security' && <SecuritySection />}
      </main>

      <AssessmentDetailModal record={selectedRecord} onClose={closeSelectedRecord} />
    </div>
    </TransactionCoordinatorProvider>
  );
}
