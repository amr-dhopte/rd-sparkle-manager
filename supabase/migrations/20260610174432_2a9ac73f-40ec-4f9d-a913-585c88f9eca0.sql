
-- Groups
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own groups" ON public.groups FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT,
  mobile TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  rd_amount NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  tenure_months INT NOT NULL DEFAULT 60,
  interest_rate NUMERIC NOT NULL DEFAULT 6.7,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers" ON public.customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Payments
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('online','cash','paid','pending')),
  paid_at TIMESTAMPTZ,
  UNIQUE (customer_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments" ON public.payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Agent settings (one row per user)
CREATE TABLE public.agent_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  agent_name TEXT NOT NULL DEFAULT 'RD Agent',
  agent_id TEXT NOT NULL DEFAULT 'AGT-0001',
  agency_name TEXT NOT NULL DEFAULT 'Post Office RD Agency',
  message_template TEXT NOT NULL DEFAULT 'Namaste {name} ji,\nApki Post Office RD ki monthly kist ₹{amount} ke liye reminder hai ({month}). Kripya jaldi jama karwayein.\nDhanyavaad,\n{agent}',
  current_rate NUMERIC NOT NULL DEFAULT 6.7,
  reminder_dismissed_for TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_settings TO authenticated;
GRANT ALL ON public.agent_settings TO service_role;
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.agent_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_settings;

ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.agent_settings REPLICA IDENTITY FULL;
