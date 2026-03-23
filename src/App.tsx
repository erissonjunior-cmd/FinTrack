import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  ChevronDown, 
  DollarSign, 
  Users, 
  Calendar, 
  LogOut,
  Search,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Loader2,
  Share2,
  Download,
  Wallet,
  FileText,
  Upload,
  Image as ImageIcon,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Debt, Installment, Card, FixedExpense, UserProfile } from './types';
import { supabase } from './supabaseClient';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const [isAddingDebt, setIsAddingDebt] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isAddingFixed, setIsAddingFixed] = useState(false);
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState<{
    debtId: string;
    installmentId: string;
    title: string;
    amount: number;
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [debtTypeFilter, setDebtTypeFilter] = useState<'all' | 'mine' | 'shared'>('all');
  const [activeTab, setActiveTab] = useState<'debts' | 'fixed' | 'cards'>('debts');
  
  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'personal' | 'installment' | 'fixed'>('installment');
  const [personName, setPersonName] = useState('');
  const [installmentCount, setInstallmentCount] = useState('1');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCardId, setSelectedCardId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Card Form State
  const [cardName, setCardName] = useState('');
  const [cardDigits, setCardDigits] = useState('');
  const [cardColor, setCardColor] = useState('#10b981');

  // Fixed Expense Form State
  const [fixedTitle, setFixedTitle] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedDueDay, setFixedDueDay] = useState('1');

  // Income State
  const [newIncome, setNewIncome] = useState('');

  // Sharing State
  const [isSharingDebt, setIsSharingDebt] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [isSharingLoading, setIsSharingLoading] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);

  // Auth State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isSupabaseConfigured = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return url && key && url !== 'your_supabase_project_url' && key !== 'your_supabase_anon_key';
  }, []);

  // Auth Listener
  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error('Supabase auth error:', error);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // PWA Install Listener
  useEffect(() => {
    // Check if it's iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isIOS && !isStandalone) {
      setShowIOSInstall(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallButton(false);
    }
    setDeferredPrompt(null);
  };

  // Load Data from Supabase
  useEffect(() => {
    if (session?.user) {
      fetchDebts();
      fetchCards();
      fetchFixedExpenses();
      fetchProfile();
    } else {
      setDebts([]);
      setCards([]);
      setFixedExpenses([]);
      setProfile(null);
    }
  }, [session]);

  async function fetchProfile() {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id);
      
      if (error) {
        console.error('Error fetching profile:', error);
      } else if (data && data.length > 0) {
        setProfile(data[0]);
        setNewIncome(data[0].monthly_income.toString());
      } else {
        // No profile found, set to null to avoid stale data
        setProfile(null);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    }
  }

  async function fetchCards() {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching cards:', error);
    else setCards(data || []);
  }

  async function fetchFixedExpenses() {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('fixed_expenses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('due_day', { ascending: true });
    
    if (error) console.error('Error fetching fixed expenses:', error);
    else setFixedExpenses(data || []);
  }

  async function fetchDebts() {
    if (!session?.user) return;

    try {
      // 1. Fetch my debts
      const { data: myData, error: myError } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', session.user.id);

      if (myError) {
        console.error('Error fetching my debts:', myError);
        // Don't alert here to avoid spamming the user, just log it
      }

      // 2. Fetch debts shared with me
      let sharedDebts: any[] = [];
      const { data: shares, error: sharesError } = await supabase
        .from('debt_shares')
        .select('debt_id')
        .eq('shared_with_email', session.user.email);

      if (sharesError) {
        console.error('Error fetching debt shares:', sharesError);
      } else if (shares && shares.length > 0) {
        const debtIds = shares.map(s => s.debt_id);
        const { data: sData, error: sError } = await supabase
          .from('debts')
          .select('*')
          .in('id', debtIds);

        if (sError) {
          console.error('Error fetching shared debts details:', sError);
        } else {
          sharedDebts = sData || [];
        }
      }

      const allDebts = [
        ...(myData || []).map(d => ({ ...d, isShared: false })),
        ...sharedDebts.map(d => ({ ...d, isShared: true }))
      ];

      // Sort all debts by created_at if possible, otherwise by id
      allDebts.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
        return b.id.localeCompare(a.id);
      });

      setDebts(allDebts);
    } catch (err) {
      console.error('Unexpected error in fetchDebts:', err);
    }
  }

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSharingDebt || !shareEmail) return;

    setIsSharingLoading(true);
    try {
      const { error } = await supabase
        .from('debt_shares')
        .insert([{
          debt_id: isSharingDebt,
          shared_with_email: shareEmail.toLowerCase().trim()
        }]);

      if (error) throw error;
      
      alert('Dívida compartilhada com sucesso!');
      setIsSharingDebt(null);
      setShareEmail('');
    } catch (error: any) {
      console.error('Error sharing debt:', error);
      alert('Erro ao compartilhar: ' + error.message);
    } finally {
      setIsSharingLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const updateIncome = async () => {
    if (!session?.user) return;
    const income = parseFloat(newIncome.replace(',', '.')) || 0;
    
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ 
        user_id: session.user.id, 
        monthly_income: income,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Error updating income:', error);
      alert(`Erro ao salvar renda: ${error.message}`);
    } else {
      setProfile({ user_id: session.user.id, monthly_income: income });
      setIsEditingIncome(false);
      fetchProfile();
    }
  };

  const addCard = async () => {
    if (!session?.user || !cardName || !cardDigits) return;
    
    const { error } = await supabase
      .from('cards')
      .insert({
        user_id: session.user.id,
        name: cardName,
        last_digits: cardDigits,
        color: cardColor
      });

    if (error) {
      console.error('Error adding card:', error);
      alert(`Erro ao adicionar cartão: ${error.message}`);
    } else {
      fetchCards();
      setIsAddingCard(false);
      setCardName('');
      setCardDigits('');
    }
  };

  const deleteCard = async (id: string) => {
    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting card:', error);
    else fetchCards();
  };

  const addFixedExpense = async () => {
    if (!session?.user || !fixedTitle || !fixedAmount) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    const amount = parseFloat(fixedAmount.replace(',', '.')) || 0;
    if (amount <= 0) {
      alert('Por favor, insira um valor válido.');
      return;
    }

    const newFixed = {
      id: crypto.randomUUID(),
      user_id: session.user.id,
      title: fixedTitle,
      amount,
      due_day: parseInt(fixedDueDay) || 1,
      category: 'fixed',
      created_at: new Date().toISOString()
    };

    console.log('Inserting fixed expense:', newFixed);

    const { error } = await supabase
      .from('fixed_expenses')
      .insert([newFixed]);

    if (error) {
      console.error('Error adding fixed expense:', error);
      alert(`Erro ao adicionar gasto fixo: ${error.message}`);
    } else {
      fetchFixedExpenses();
      setIsAddingFixed(false);
      setFixedTitle('');
      setFixedAmount('');
      setFixedDueDay('1');
    }
  };

  const deleteFixedExpense = async (id: string) => {
    const { error } = await supabase
      .from('fixed_expenses')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting fixed expense:', error);
    else fetchFixedExpenses();
  };

  const uploadReceipt = async (file: File) => {
    if (!session?.user) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}/${crypto.randomUUID()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading receipt:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const addDebt = async () => {
    if (!title || !amount || !startDate || !session?.user) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const total = parseFloat(amount.replace(',', '.')) || 0;
    const count = parseInt(installmentCount) || 1;

    if (total <= 0) {
      alert('Por favor, insira um valor válido.');
      return;
    }

    const installments: Installment[] = [];

    try {
      for (let i = 0; i < count; i++) {
        installments.push({
          id: crypto.randomUUID(),
          number: i + 1,
          amount: total / count,
          dueDate: format(addMonths(parseISO(startDate), i), 'yyyy-MM-dd'),
          isPaid: false
        });
      }
    } catch (err) {
      console.error('Error generating installments:', err);
      alert('Erro ao gerar parcelas. Verifique a data de início.');
      return;
    }

    const newDebt = {
      user_id: session.user.id,
      title,
      total_amount: total,
      category,
      person_name: category === 'personal' ? personName : null,
      card_id: selectedCardId || null,
      installments,
      created_at: new Date().toISOString(),
    };

    console.log('Inserting debt:', newDebt);

    const { error } = await supabase
      .from('debts')
      .insert([newDebt]);

    if (error) {
      console.error('Error adding debt:', error);
      alert(`Erro ao salvar dívida: ${error.message}`);
    } else {
      fetchDebts();
      setIsAddingDebt(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('installment');
    setPersonName('');
    setInstallmentCount('1');
    setReceiptFile(null);
  };

  const toggleInstallment = async (debtId: string, installmentId: string) => {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const installments = Array.isArray(debt.installments) ? debt.installments : [];
    const installment = installments.find(i => i.id === installmentId);
    if (!installment) return;

    if (!installment.isPaid) {
      setPaymentModalData({
        debtId,
        installmentId,
        title: debt.title,
        amount: installment.amount
      });
    } else {
      const updatedInstallments = installments.map(i => 
        i.id === installmentId ? { ...i, isPaid: false, receipt_url: undefined } : i
      );

      const { error } = await supabase
        .from('debts')
        .update({ installments: updatedInstallments })
        .eq('id', debtId);

      if (error) {
        console.error('Error updating installment:', error);
      } else {
        setDebts(debts.map(d => d.id === debtId ? { ...d, installments: updatedInstallments } : d));
      }
    }
  };

  const confirmPayment = async () => {
    if (!paymentModalData) return;
    const { debtId, installmentId } = paymentModalData;

    let receiptUrl = undefined;
    if (receiptFile) {
      receiptUrl = await uploadReceipt(receiptFile);
    }

    if (installmentId === 'fixed') {
      // Handle fixed expense payment
      const { error } = await supabase
        .from('fixed_expenses')
        .update({ receipt_url: receiptUrl })
        .eq('id', debtId);

      if (error) {
        console.error('Error confirming fixed expense payment:', error);
        alert('Erro ao confirmar pagamento.');
      } else {
        setFixedExpenses(fixedExpenses.map(f => f.id === debtId ? { ...f, receipt_url: receiptUrl } : f));
        setPaymentModalData(null);
        setReceiptFile(null);
      }
      return;
    }

    if (installmentId === 'card') {
      // Handle card bill payment
      const { error } = await supabase
        .from('cards')
        .update({ receipt_url: receiptUrl })
        .eq('id', debtId);

      if (error) {
        console.error('Error confirming card payment:', error);
        alert('Erro ao confirmar pagamento.');
      } else {
        // Also mark all pending installments for this card as paid
        const cardDebts = debts.filter(d => d.card_id === debtId);
        for (const debt of cardDebts) {
          const installments = Array.isArray(debt.installments) ? debt.installments : [];
          const updatedInstallments = installments.map(i => ({ ...i, isPaid: true }));
          await supabase
            .from('debts')
            .update({ installments: updatedInstallments })
            .eq('id', debt.id);
        }
        
        fetchDebts();
        setCards(cards.map(c => c.id === debtId ? { ...c, receipt_url: receiptUrl } : c));
        setPaymentModalData(null);
        setReceiptFile(null);
      }
      return;
    }

    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const installments = Array.isArray(debt.installments) ? debt.installments : [];
    const updatedInstallments = installments.map(i => 
      i.id === installmentId ? { ...i, isPaid: true, receipt_url: receiptUrl } : i
    );

    const { error } = await supabase
      .from('debts')
      .update({ installments: updatedInstallments })
      .eq('id', debtId);

    if (error) {
      console.error('Error confirming payment:', error);
      alert('Erro ao confirmar pagamento.');
    } else {
      setDebts(debts.map(d => d.id === debtId ? { ...d, installments: updatedInstallments } : d));
      setPaymentModalData(null);
      setReceiptFile(null);
    }
  };

  const deleteDebt = async (id: string, isShared: boolean) => {
    if (isShared) {
      const { error } = await supabase
        .from('debt_shares')
        .delete()
        .eq('debt_id', id)
        .eq('shared_with_email', session.user.email);

      if (error) {
        console.error('Error deleting share:', error);
      } else {
        setDebts(debts.filter(d => d.id !== id));
      }
    } else {
      const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting debt:', error);
      } else {
        setDebts(debts.filter(d => d.id !== id));
      }
    }
  };

  const filteredDebts = useMemo(() => {
    return debts.filter(d => {
      if (activeTab !== 'debts') return false;

      const matchesType = debtTypeFilter === 'all' ? true : 
                         debtTypeFilter === 'mine' ? !d.isShared : d.isShared;
      if (!matchesType) return false;

      const matchesSearch = (d.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                           (d.person_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      // Handle cases where installments might be missing or in a different format
      const installments = Array.isArray(d.installments) ? d.installments : [];
      
      if (installments.length === 0) {
        // If no installments found, treat as a single pending installment for display
        if (filter === 'paid') return false;
        return matchesSearch;
      }

      const allPaid = installments.every(i => i.isPaid);
      if (filter === 'paid') return matchesSearch && allPaid;
      if (filter === 'pending') return matchesSearch && !allPaid;
      return matchesSearch;
    });
  }, [debts, searchTerm, filter, activeTab]);

  const stats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    let mineTotal = 0;
    let sharedTotal = 0;
    let fixedTotal = 0;

    debts.forEach(d => {
      const installments = Array.isArray(d.installments) ? d.installments : [];
      installments.forEach(i => {
        total += i.amount;
        if (i.isPaid) paid += i.amount;
        else pending += i.amount;
        
        if (d.isShared) sharedTotal += i.amount;
        else mineTotal += i.amount;
      });
    });

    fixedExpenses.forEach(f => {
      fixedTotal += f.amount;
      total += f.amount;
      pending += f.amount; // Fixed expenses are usually pending until paid (though we don't track paid state for them yet in the same way)
    });

    return { total, paid, pending, mineTotal, sharedTotal, fixedTotal };
  }, [debts, fixedExpenses]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-card p-8 space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">FinTrack</h1>
            <p className="text-white/50">Gerencie suas finanças com precisão</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-500">Configuração Pendente</p>
                <p className="text-xs text-white/60 leading-relaxed">
                  As chaves do Supabase não foram encontradas. Por favor, configure as variáveis de ambiente <code className="bg-white/5 px-1 rounded">VITE_SUPABASE_URL</code> e <code className="bg-white/5 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> no menu Settings.
                </p>
              </div>
            </div>
          )}

          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/40">E-mail</label>
              <input 
                type="email" 
                required
                className="w-full input-field"
                placeholder="seu@email.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Senha</label>
              <input 
                type="password" 
                required
                className="w-full input-field"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary mt-4 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isRegistering ? 'Criar Conta' : 'Entrar'}
            </button>
          </form>

          <div className="text-center space-y-4">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-sm text-white/40 hover:text-white transition-colors"
            >
              {isRegistering ? 'Já tem uma conta? Entre' : 'Não tem conta? Cadastre-se'}
            </button>
            <div className="pt-4 border-t border-white/5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">
                Criado por <span className="text-emerald-500/50">Erisson Junior</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">FinTrack</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/40">{session.user.email}</p>
                {!isSupabaseConfigured && (
                  <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    Modo Demo
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {/* iOS PWA Install Banner */}
        <AnimatePresence>
          {showIOSInstall && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Adicionar ao iPhone</p>
                    <p className="text-xs text-white/40">Use como um aplicativo nativo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowIOSInstall(false)}
                  className="text-white/40 hover:text-white"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <div className="bg-white/5 p-3 rounded-xl space-y-2">
                <p className="text-xs text-white/60 flex items-center gap-2">
                  1. Toque no botão <Share2 className="w-3 h-3 inline" /> no Safari
                </p>
                <p className="text-xs text-white/60 flex items-center gap-2">
                  2. Role para baixo e toque em <Plus className="w-3 h-3 inline border border-white/20 rounded-sm p-0.5" /> <strong>Adicionar à Tela de Início</strong>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PWA Install Banner */}
        <AnimatePresence>
          {showInstallButton && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <Download className="w-5 h-5 text-black" />
                </div>
                <div>
                  <p className="text-sm font-bold">Instalar FinTrack</p>
                  <p className="text-xs text-white/40">Adicione à tela de início para acesso rápido</p>
                </div>
              </div>
              <button
                onClick={handleInstallClick}
                className="bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-colors"
              >
                Instalar
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex p-1 bg-white/5 rounded-2xl w-full max-w-xl mx-auto overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('debts')}
            className={cn(
              "flex-1 min-w-[120px] py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2",
              activeTab === 'debts' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-white/40 hover:text-white"
            )}
          >
            <DollarSign className="w-4 h-4" />
            Meus Gastos
          </button>
          <button 
            onClick={() => setActiveTab('fixed')}
            className={cn(
              "flex-1 min-w-[120px] py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2",
              activeTab === 'fixed' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-white/40 hover:text-white"
            )}
          >
            <Calendar className="w-4 h-4" />
            Gastos Fixos
          </button>
          <button 
            onClick={() => setActiveTab('cards')}
            className={cn(
              "flex-1 min-w-[120px] py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2",
              activeTab === 'cards' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-white/40 hover:text-white"
            )}
          >
            <CreditCard className="w-4 h-4" />
            Cartões
          </button>
        </div>

        {/* Budget Section */}
        <div className="glass-card p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold">Meu Orçamento</h3>
                <p className="text-xs text-white/40">Controle de renda mensal</p>
              </div>
            </div>
            <button 
              onClick={() => setIsEditingIncome(!isEditingIncome)}
              className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              {isEditingIncome ? 'Cancelar' : 'Editar Renda'}
            </button>
          </div>

          {isEditingIncome ? (
            <div className="flex gap-3">
              <div className="relative flex-1">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  type="number"
                  value={newIncome}
                  onChange={(e) => setNewIncome(e.target.value)}
                  placeholder="Valor recebido mensalmente"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
              <button 
                onClick={updateIncome}
                className="bg-emerald-500 text-black px-6 rounded-xl text-sm font-bold hover:bg-emerald-400 transition-colors"
              >
                Salvar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Renda Mensal</p>
                  <p className="text-2xl font-bold text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(profile?.monthly_income || 0)}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40">Meus Gastos:</span>
                    <span className="font-medium text-white/80">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.mineTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40">Compartilhados:</span>
                    <span className="font-medium text-indigo-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.sharedTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40">Gastos Fixos:</span>
                    <span className="font-medium text-orange-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.fixedTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Saldo Restante</p>
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "text-2xl font-bold",
                    (profile?.monthly_income || 0) - stats.total > 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((profile?.monthly_income || 0) - stats.total)}
                  </p>
                  {(profile?.monthly_income || 0) - stats.total > 0 ? (
                    <ArrowUpCircle className="w-5 h-5 text-emerald-500/50" />
                  ) : (
                    <ArrowDownCircle className="w-5 h-5 text-red-500/50" />
                  )}
                </div>
                <p className="text-[10px] text-white/20 mt-1 italic">
                  * Inclui gastos parcelados, compartilhados e fixos.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            label="Total em Dívidas" 
            value={stats.total} 
            icon={<DollarSign className="w-5 h-5" />}
            color="text-white"
          />
          <StatCard 
            label="Total Pago" 
            value={stats.paid} 
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="text-emerald-500"
          />
          <StatCard 
            label="Pendente" 
            value={stats.pending} 
            icon={<AlertCircle className="w-5 h-5" />}
            color="text-orange-500"
          />
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input 
                type="text"
                placeholder="Buscar..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {activeTab === 'debts' && (
              <>
                <select 
                  className="input-field px-3 py-2 text-sm"
                  value={debtTypeFilter}
                  onChange={(e) => setDebtTypeFilter(e.target.value as any)}
                >
                  <option value="all">Todos os Gastos</option>
                  <option value="mine">Adicionados</option>
                  <option value="shared">Compartilhados</option>
                </select>
                <select 
                  className="input-field px-3 py-2 text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                >
                  <option value="all">Status: Todos</option>
                  <option value="pending">Pendentes</option>
                  <option value="paid">Pagos</option>
                </select>
              </>
            )}
          </div>
          
          {activeTab === 'debts' && (
            <button 
              onClick={() => setIsAddingDebt(true)}
              className="w-full md:w-auto btn-primary flex items-center justify-center gap-2 py-2"
            >
              <Plus className="w-5 h-5" />
              Nova Dívida
            </button>
          )}
          {activeTab === 'fixed' && (
            <button 
              onClick={() => setIsAddingFixed(true)}
              className="w-full md:w-auto bg-orange-500 text-white px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-all"
            >
              <Plus className="w-5 h-5" />
              Novo Gasto Fixo
            </button>
          )}
          {activeTab === 'cards' && (
            <button 
              onClick={() => setIsAddingCard(true)}
              className="w-full md:w-auto bg-blue-500 text-white px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-all"
            >
              <Plus className="w-5 h-5" />
              Novo Cartão
            </button>
          )}
        </div>

        {/* List Content */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {activeTab === 'debts' ? (
              filteredDebts.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 glass-card"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/40">Nenhuma dívida encontrada.</p>
                </motion.div>
              ) : (
                filteredDebts.map((debt) => (
                  <DebtItem 
                    key={debt.id} 
                    debt={debt} 
                    cards={cards}
                    onToggle={toggleInstallment}
                    onDelete={deleteDebt}
                    onShare={(id) => setIsSharingDebt(id)}
                  />
                ))
              )
            ) : activeTab === 'fixed' ? (
              fixedExpenses.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 glass-card"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/40">Nenhum gasto fixo encontrado.</p>
                </motion.div>
              ) : (
                fixedExpenses.map((fixed) => (
                  <motion.div
                    key={fixed.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{fixed.title}</h4>
                        <p className="text-xs text-white/40">Vence todo dia {fixed.due_day}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <p className="text-xl font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fixed.amount)}
                      </p>
                      <div className="flex items-center gap-2">
                        {!fixed.receipt_url && (
                          <button 
                            onClick={() => setPaymentModalData({
                              debtId: fixed.id, // Using debtId as a generic ID for the modal
                              installmentId: 'fixed', // Special marker for fixed expenses
                              title: fixed.title,
                              amount: fixed.amount
                            })}
                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-all flex items-center gap-2"
                            title="Pagar"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-bold">Pagar</span>
                          </button>
                        )}
                        {fixed.receipt_url && (
                          <a 
                            href={fixed.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg transition-all"
                            title="Ver comprovante"
                          >
                            <ImageIcon className="w-5 h-5" />
                          </a>
                        )}
                        <button 
                          onClick={() => deleteFixedExpense(fixed.id)}
                          className="p-2 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )
            ) : (
              cards.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 glass-card"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/40">Nenhum cartão encontrado.</p>
                </motion.div>
              ) : (
                cards.map((card) => (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6 flex items-center justify-between group overflow-hidden relative"
                  >
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1.5"
                      style={{ backgroundColor: card.color }}
                    />
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${card.color}20`, color: card.color }}
                      >
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{card.name}</h4>
                        <p className="text-xs text-white/40">Final **** {card.last_digits}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        disabled={debts
                          .filter(d => d.card_id === card.id)
                          .reduce((acc, d) => {
                            const installments = Array.isArray(d.installments) ? d.installments : [];
                            return acc + installments
                              .filter(i => !i.isPaid)
                              .reduce((sum, i) => sum + i.amount, 0);
                          }, 0) === 0}
                        onClick={() => {
                          const pendingAmount = debts
                            .filter(d => d.card_id === card.id)
                            .reduce((acc, d) => {
                              const installments = Array.isArray(d.installments) ? d.installments : [];
                              return acc + installments
                                .filter(i => !i.isPaid)
                                .reduce((sum, i) => sum + i.amount, 0);
                            }, 0);
                          
                          setPaymentModalData({
                            debtId: card.id,
                            installmentId: 'card',
                            title: `Fatura: ${card.name}`,
                            amount: pendingAmount
                          });
                        }}
                        className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-500 rounded-lg transition-all flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-bold">Pagar Fatura</span>
                      </button>
                      {card.receipt_url && (
                        <a 
                          href={card.receipt_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg transition-all"
                          title="Ver comprovante"
                        >
                          <ImageIcon className="w-5 h-5" />
                        </a>
                      )}
                      <button 
                        onClick={() => deleteCard(card.id)}
                        className="p-2 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded-lg transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-8 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">
          Criado por <span className="text-emerald-500/50">Erisson Junior</span>
        </p>
      </footer>

      {/* Payment Confirmation Modal */}
      <AnimatePresence>
        {paymentModalData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setPaymentModalData(null);
                setReceiptFile(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-card p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Confirmar Pagamento
                </h3>
                <button 
                  onClick={() => {
                    setPaymentModalData(null);
                    setReceiptFile(null);
                  }} 
                  className="text-white/40 hover:text-white"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">{paymentModalData.title}</p>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paymentModalData.amount)}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Comprovante (Opcional)</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="payment-receipt-upload"
                    />
                    <label 
                      htmlFor="payment-receipt-upload"
                      className="w-full flex items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 border-dashed rounded-xl cursor-pointer hover:bg-white/10 transition-all"
                    >
                      <Upload className="w-4 h-4 text-white/40" />
                      <span className="text-sm text-white/40">
                        {receiptFile ? receiptFile.name : 'Anexar comprovante'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => {
                      setPaymentModalData(null);
                      setReceiptFile(null);
                    }}
                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmPayment}
                    className="flex-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl transition-all"
                  >
                    Confirmar Pagamento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Debt Modal */}
      <AnimatePresence>
        {isAddingDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingDebt(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-card p-8 space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Nova Dívida</h3>
                <button onClick={() => setIsAddingDebt(false)} className="text-white/40 hover:text-white">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setCategory('installment')}
                    className={cn(
                      "p-4 rounded-xl border transition-all flex flex-col items-center gap-2",
                      category === 'installment' ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-white/5 border-white/10 text-white/40"
                    )}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="text-xs font-bold uppercase">Parcelado</span>
                  </button>
                  <button 
                    onClick={() => setCategory('personal')}
                    className={cn(
                      "p-4 rounded-xl border transition-all flex flex-col items-center gap-2",
                      category === 'personal' ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-white/5 border-white/10 text-white/40"
                    )}
                  >
                    <Users className="w-6 h-6" />
                    <span className="text-xs font-bold uppercase">Pessoal</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Título</label>
                  <input 
                    type="text" 
                    className="w-full input-field"
                    placeholder="Ex: Passagem Aérea"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {category === 'personal' && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Nome da Pessoa</label>
                    <input 
                      type="text" 
                      className="w-full input-field"
                      placeholder="Ex: João Silva"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Valor Total</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-mono text-sm pointer-events-none">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full input-field !pl-12"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Parcelas</label>
                    <input 
                      type="number" 
                      className="w-full input-field"
                      min="1"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Data de Início</label>
                  <input 
                    type="date" 
                    className="w-full input-field"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Cartão (Opcional)</label>
                  <select 
                    className="w-full input-field"
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                  >
                    <option value="">Nenhum cartão</option>
                    {cards.map(card => (
                      <option key={card.id} value={card.id}>{card.name} (**** {card.last_digits})</option>
                    ))}
                  </select>
                </div>

                <button onClick={addDebt} className="w-full btn-primary pt-4">
                  Adicionar Dívida
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Card Modal */}
      <AnimatePresence>
        {isAddingCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingCard(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-card p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                  Novo Cartão
                </h3>
                <button onClick={() => setIsAddingCard(false)} className="text-white/40 hover:text-white">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Nome do Cartão</label>
                  <input 
                    type="text" 
                    className="w-full input-field"
                    placeholder="Ex: Nubank Platinum"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Últimos 4 Dígitos</label>
                  <input 
                    type="text" 
                    maxLength={4}
                    className="w-full input-field"
                    placeholder="Ex: 1234"
                    value={cardDigits}
                    onChange={(e) => setCardDigits(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Cor do Cartão</label>
                  <div className="flex gap-2">
                    {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'].map(color => (
                      <button
                        key={color}
                        onClick={() => setCardColor(color)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          cardColor === color ? "border-white scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button onClick={addCard} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all">
                  Salvar Cartão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Fixed Expense Modal */}
      <AnimatePresence>
        {isAddingFixed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingFixed(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-card p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-400" />
                  Novo Gasto Fixo
                </h3>
                <button onClick={() => setIsAddingFixed(false)} className="text-white/40 hover:text-white">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Título</label>
                  <input 
                    type="text" 
                    className="w-full input-field"
                    placeholder="Ex: Aluguel"
                    value={fixedTitle}
                    onChange={(e) => setFixedTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Valor</label>
                    <input 
                      type="number" 
                      className="w-full input-field"
                      placeholder="0.00"
                      value={fixedAmount}
                      onChange={(e) => setFixedAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Dia do Vencimento</label>
                    <input 
                      type="number" 
                      min="1"
                      max="31"
                      className="w-full input-field"
                      value={fixedDueDay}
                      onChange={(e) => setFixedDueDay(e.target.value)}
                    />
                  </div>
                </div>

                <button onClick={addFixedExpense} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-all">
                  Salvar Gasto Fixo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Debt Modal */}
      <AnimatePresence>
        {isSharingDebt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSharingDebt(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-card p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-indigo-400" />
                  Compartilhar Dívida
                </h3>
                <button onClick={() => setIsSharingDebt(null)} className="text-white/40 hover:text-white">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <p className="text-sm text-white/50">
                Insira o e-mail da pessoa com quem deseja compartilhar esta dívida. Ela poderá visualizar todos os detalhes e status das parcelas.
              </p>

              <form onSubmit={handleShare} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/40">E-mail do Destinatário</label>
                  <input 
                    type="email" 
                    required
                    className="w-full input-field"
                    placeholder="exemplo@email.com"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSharingLoading}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isSharingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  Compartilhar Agora
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <div className="glass-card p-6 flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-white/5", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">{label}</p>
        <p className="text-2xl font-bold">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
        </p>
      </div>
    </div>
  );
}

const DebtItem: React.FC<{ 
  debt: Debt & { isShared?: boolean }; 
  cards: Card[];
  onToggle: (d: string, i: string) => void; 
  onDelete: (id: string, isShared: boolean) => void;
  onShare: (id: string) => void;
}> = ({ debt, cards, onToggle, onDelete, onShare }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const installments = Array.isArray(debt.installments) ? debt.installments : [];
  const paidCount = installments.filter(i => i.isPaid).length;
  const totalCount = installments.length;
  const isFullyPaid = totalCount > 0 && paidCount === totalCount;

  const associatedCard = cards.find(c => c.id === debt.card_id);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "glass-card overflow-hidden transition-all",
        isFullyPaid && "opacity-60 grayscale-[0.5]",
        debt.isShared && "border-indigo-500/30 bg-indigo-500/[0.02]"
      )}
    >
      <div 
        className="p-6 flex items-center justify-between cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            debt.isShared ? "bg-indigo-500/10 text-indigo-500" :
            debt.category === 'installment' ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
          )}>
            {debt.isShared ? <Users className="w-6 h-6" /> :
             debt.category === 'installment' ? <CreditCard className="w-6 h-6" /> : <Users className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className={cn(
                "font-bold text-lg transition-colors",
                debt.isShared ? "group-hover:text-indigo-400" : "group-hover:text-emerald-400"
              )}>{debt.title}</h4>
              {debt.isShared && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md">
                  Compartilhado
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(parseISO(debt.created_at), "dd MMM yyyy", { locale: ptBR })}
              </span>
              {debt.person_name && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {debt.person_name}
                </span>
              )}
              <span className="bg-white/5 px-2 py-0.5 rounded-full">
                {paidCount}/{totalCount} parcelas pagas
              </span>
              {associatedCard && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded-full">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: associatedCard.color }} />
                  <span className="text-[10px] font-medium text-white/60">{associatedCard.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(debt.total_amount)}
            </p>
            <p className="text-xs text-white/40">Total</p>
          </div>
          <div className="flex items-center gap-2">
            {!debt.isShared && (
              <button 
                onClick={(e) => { e.stopPropagation(); onShare(debt.id); }}
                className="p-2 bg-white/5 hover:bg-indigo-500/10 text-white/40 hover:text-indigo-500 rounded-lg transition-all"
                title="Compartilhar"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(debt.id, !!debt.isShared); }}
              className="p-2 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded-lg transition-all"
              title={debt.isShared ? "Remover Compartilhamento" : "Excluir"}
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <div className={cn("transition-transform duration-300", isExpanded && "rotate-180")}>
              <ChevronDown className="w-5 h-5 text-white/40" />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(
              "border-t border-white/5",
              debt.isShared ? "bg-indigo-500/[0.01]" : "bg-white/[0.02]"
            )}
          >
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(Array.isArray(debt.installments) ? debt.installments : []).map((inst) => (
                <div 
                  key={inst.id}
                  onClick={() => !debt.isShared && onToggle(debt.id, inst.id)}
                  className={cn(
                    "p-4 rounded-xl border transition-all flex items-center justify-between group/inst",
                    !debt.isShared && "cursor-pointer",
                    inst.isPaid 
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" 
                      : "bg-white/5 border-white/10 text-white",
                    !debt.isShared && !inst.isPaid && "hover:border-white/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                      inst.isPaid ? "bg-emerald-500 text-black" : "bg-white/10 text-white/40",
                      !debt.isShared && !inst.isPaid && "group-hover/inst:bg-white/20"
                    )}>
                      {inst.isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">Parcela {inst.number}</p>
                      <p className="text-sm font-mono opacity-60">
                        {format(parseISO(inst.dueDate), "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inst.receipt_url && (
                      <a 
                        href={inst.receipt_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg transition-all"
                        title="Ver Comprovante"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    )}
                    <p className="font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


