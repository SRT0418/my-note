-- =========================================================
-- MyNote Supabase データベース構築 & 認証・権限設定 SQL
-- Supabaseコンソールの 「SQL Editor」 に貼り付けて実行してください。
-- =========================================================

-- 1. ユーザープロフィール & 権限管理テーブルの作成
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'user',     -- 'admin' または 'user'
    status TEXT NOT NULL DEFAULT 'active', -- 'active' または 'suspended'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) 有効化
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. クラウドデータ保存用テーブルの作成 (各機能のデータキーと内容)
CREATE TABLE IF NOT EXISTS public.user_data (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    data_key TEXT NOT NULL,
    content JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, data_key)
);

-- RLS 有効化
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- RLS (Row Level Security) ポリシー設定 (既存があれば一度削除して作成)
-- =========================================================

-- ----- profiles テーブルのポリシー -----

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Anyone can view profiles" 
ON public.profiles FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" 
ON public.profiles FOR DELETE 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" 
ON public.profiles FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);


-- ----- user_data テーブルのポリシー -----

DROP POLICY IF EXISTS "Users can manage own data" ON public.user_data;
CREATE POLICY "Users can manage own data" 
ON public.user_data FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all user data" ON public.user_data;
CREATE POLICY "Admins can manage all user data" 
ON public.user_data FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);


-- =========================================================
-- 新規ユーザー登録時の自動プロフィール作成トリガー
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    u_name TEXT;
    is_first_user BOOLEAN;
BEGIN
    u_name := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    
    -- 初めて登録されたユーザーを自動的に管理者(admin)にする判定
    SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

    INSERT INTO public.profiles (id, username, email, role, status)
    VALUES (
        NEW.id,
        u_name,
        NEW.email,
        CASE WHEN is_first_user THEN 'admin' ELSE 'user' END,
        'active'
    )
    ON CONFLICT (id) DO UPDATE 
    SET username = EXCLUDED.username,
        email = EXCLUDED.email;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガー登録 (auth.users への INSERT 時)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
