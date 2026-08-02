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
} from '@/lib/genlayer';
import { TransactionCoordinatorProvider } from '@/lib/transactionCoordinator';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'request' | 'registry' | 'security'>('request');
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AssessmentRecord | null>(null);

  const isConfigured = isContractConfigured();

  const fetchAssessmentCountAndRecords = useCallback(async (): Promise<void> => {
    if (!isConfigured) return;

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <ContractStatusBanner />

        {activeTab === 'request' && (
          <div className="space-y-8">
            <RequestAssessmentForm onTransactionSuccess={fetchAssessmentCountAndRecords} />
            <AssessmentList
              assessments={assessments}
              onSelectRecord={setSelectedRecord}
              onRefresh={fetchAssessmentCountAndRecords}
            />
          </div>
        )}

        {activeTab === 'registry' && (
          <AssessmentList
            assessments={assessments}
            onSelectRecord={setSelectedRecord}
            onRefresh={fetchAssessmentCountAndRecords}
          />
        )}

        {activeTab === 'security' && <SecuritySection />}
      </main>

      <AssessmentDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
    </TransactionCoordinatorProvider>
  );
}
