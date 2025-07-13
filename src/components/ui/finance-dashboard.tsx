'use client'

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, UserButton } from "@clerk/nextjs";
import { createClient } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Plus, X } from "lucide-react";
import ScanFlow from '@/components/ui/scan-flow';
import type { Transaction } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const BentoBox = ({ children, className, onClick }: { 
  children: React.ReactNode, 
  className?: string, 
  onClick?: () => void 
}) => (
  <div 
    onClick={onClick} 
    className={`bg-surface rounded-3xl p-6 shadow-subtle hover:shadow-soft transition-all duration-300 hover:-translate-y-1 ${className}`}
  >
    {children}
  </div>
);

export default function FinanceDashboard() {
  const [isScanFlowOpen, setScanFlowOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>(['Einkäufe', 'Gehalt', 'Unterhaltung', 'Miete']);
  const [loading, setLoading] = useState(true);

  const { getToken } = useAuth();

  const getSupabaseClient = useCallback(async (): Promise<SupabaseClient | null> => {
    const supabaseAccessToken = await getToken({ template: 'supabase' });
    if (!supabaseAccessToken) return null;
    const client = createClient();
    client.auth.setSession({
      access_token: supabaseAccessToken,
      refresh_token: '',
    });
    return client;
  }, [getToken]);


  const fetchTransactions = useCallback(async (retryCount = 0) => {
    setLoading(true);
    const supabase = await getSupabaseClient();
    if (!supabase) {
        setLoading(false);
        return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();

    // KORREKTUR: Wenn der Nutzer nicht sofort gefunden wird, warten und erneut versuchen.
    if (!user) {
        if (retryCount < 3) { // Versuche es maximal 3 Mal
            console.warn(`Supabase user not found, retrying in 2 seconds... (Attempt ${retryCount + 1})`);
            setTimeout(() => fetchTransactions(retryCount + 1), 2000);
            return;
        }
        console.error("Fetch Error: User not found in Supabase after multiple retries.");
        setLoading(false);
        return;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch Error:", error);
    } else if (data) {
      setTransactions(data);
    }
    setLoading(false);
  }, [getSupabaseClient]);


  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const currentBalance = useMemo(() => 
    transactions.reduce((sum, tx) => sum + tx.amount, 0),
  [transactions]);

  const handleNewTransactionsAction = async (newTransactions: Omit<Transaction, 'id' | 'user_id' | 'created_at'>[]) => {
    if (newTransactions.length === 0) return;

    const supabase = await getSupabaseClient();
    if (!supabase) return;
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.error("Nutzer nicht gefunden, kann nicht speichern.");
        alert("Fehler: Ihre Sitzung ist nicht gültig. Bitte laden Sie die Seite neu.");
        return;
    }
    
    const transactionsToInsert = newTransactions.map(tx => ({ 
        ...tx, 
        user_id: user.id
    }));
    
    const { error: insertError } = await supabase.from('transactions').insert(transactionsToInsert);
    
    if (insertError) {
      console.error("Error inserting transactions:", insertError);
    } else {
      await fetchTransactions(); 
    }
    setScanFlowOpen(false);
  };
  
  return (
    <>
      <main className="p-4 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[192px] gap-6 max-w-6xl mx-auto">
          
          <BentoBox className="md:col-span-2 md:row-span-2 flex flex-col justify-between bg-gradient-to-br from-blue-50 to-indigo-100">
            <div>
              <p className="text-secondary-text font-medium">Verfügbares Guthaben</p>
              <p className="text-5xl font-semibold tracking-tighter mt-1">
                {currentBalance.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className="flex items-center text-green-600 font-semibold">
              <ArrowUpRight size={18} className="mr-1" />
              <span>Daten sind aktuell</span>
            </div>
          </BentoBox>

          <BentoBox className="md:col-span-1 flex flex-col items-center justify-center gap-4">
             <div className="h-12 w-12">
                <UserButton afterSignOutUrl="/"/>
             </div>
             <p className="text-sm font-semibold">Profil</p>
          </BentoBox>

          <BentoBox className="md:col-span-1 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-gray-50" onClick={() => setScanFlowOpen(true)}>
            <div className="h-12 w-12 bg-accent text-white flex items-center justify-center rounded-2xl">
              <Plus size={28}/>
            </div>
            <p className="text-sm font-semibold">Scan hinzufügen</p>
          </BentoBox>

          <BentoBox className="md:col-span-4 flex flex-col">
            <h2 className="font-semibold text-lg mb-4">Letzte Transaktionen</h2>
            <div className="flex-grow overflow-y-auto pr-2">
              {loading ? <p className="text-secondary-text">Transaktionen werden geladen...</p> : (
                transactions.length > 0 ? (
                  <ul className="space-y-4">
                    {transactions.map(tx => (
                      <li key={tx.id} className="flex justify-between items-center">
                        <div>
                          <span>{tx.name}</span>
                          <p className="text-sm text-secondary-text">{tx.category}</p>
                        </div>
                        <span className={`font-medium ${tx.amount > 0 ? 'text-green-600' : ''}`}>
                          {tx.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-secondary-text">Noch keine Transaktionen vorhanden.</p>
                )
              )}
            </div>
          </BentoBox>

        </div>
      </main>

      <AnimatePresence>
        {isScanFlowOpen && (
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 flex items-center justify-center p-4">
            <motion.div className="relative w-full max-w-lg h-auto max-h-[90vh] bg-base/90 backdrop-blur-xl rounded-3xl shadow-2xl">
              <button onClick={() => setScanFlowOpen(false)} className="absolute top-4 right-4 p-2 bg-black/10 rounded-full hover:bg-black/20 transition-colors z-20"><X size={20} className="text-white/80" /></button>
              <ScanFlow onCompleteAction={handleNewTransactionsAction} categories={categories} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}