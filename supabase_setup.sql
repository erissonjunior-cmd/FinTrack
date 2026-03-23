-- SQL Setup for FinTrack App (FINAL VERSION)
-- Execute this in your Supabase SQL Editor to ensure a clean and correct structure.

-- 1. CLEANUP (Optional: Uncomment if you want to reset everything)
-- DROP TABLE IF EXISTS public.debt_shares CASCADE;
-- DROP TABLE IF EXISTS public.debts CASCADE;
-- DROP TABLE IF EXISTS public.fixed_expenses CASCADE;
-- DROP TABLE IF EXISTS public.cards CASCADE;
-- DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- 2. USER PROFILES
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_income NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 3. CARDS
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    last_digits TEXT,
    color TEXT DEFAULT '#10b981',
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FIXED EXPENSES
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    due_day INTEGER DEFAULT 1,
    category TEXT DEFAULT 'fixed',
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DEBTS
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    category TEXT NOT NULL, -- 'personal' or 'installment'
    person_name TEXT,
    card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
    installments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DEBT SHARES
CREATE TABLE IF NOT EXISTS public.debt_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    user_id UUID DEFAULT auth.uid(), -- Added to prevent RLS recursion
    shared_with_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(debt_id, shared_with_email)
);

-- 7. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_shares ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES (Non-recursive versions)

-- User Profiles
DROP POLICY IF EXISTS "profiles_owner_all" ON public.user_profiles;
CREATE POLICY "profiles_owner_all" ON public.user_profiles FOR ALL USING (auth.uid() = user_id);

-- Cards
DROP POLICY IF EXISTS "cards_owner_all" ON public.cards;
CREATE POLICY "cards_owner_all" ON public.cards FOR ALL USING (auth.uid() = user_id);

-- Fixed Expenses
DROP POLICY IF EXISTS "fixed_owner_all" ON public.fixed_expenses;
CREATE POLICY "fixed_owner_all" ON public.fixed_expenses FOR ALL USING (auth.uid() = user_id);

-- Debts
DROP POLICY IF EXISTS "debts_owner_all" ON public.debts;
CREATE POLICY "debts_owner_all" ON public.debts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "debts_shared_read" ON public.debts;
CREATE POLICY "debts_shared_read" ON public.debts FOR SELECT USING (
  id IN (SELECT debt_id FROM public.debt_shares WHERE shared_with_email = auth.jwt()->>'email')
);

-- Debt Shares
DROP POLICY IF EXISTS "shares_owner_all" ON public.debt_shares;
CREATE POLICY "shares_owner_all" ON public.debt_shares FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shares_recipient_read" ON public.debt_shares;
CREATE POLICY "shares_recipient_read" ON public.debt_shares FOR SELECT USING (shared_with_email = auth.jwt()->>'email');

-- 9. INDEXES
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_id ON public.fixed_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON public.cards(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_shares_email ON public.debt_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_debt_shares_user_id ON public.debt_shares(user_id);
