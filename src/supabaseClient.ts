import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: any;

const isConfigured = supabaseUrl && supabaseAnonKey && 
                    supabaseUrl !== 'your_supabase_project_url' && 
                    supabaseAnonKey !== 'your_supabase_anon_key';

if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
  }
}

if (!supabase) {
  if (!isConfigured) {
    console.warn('Supabase credentials missing or using placeholders. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
  }
  
  // Create a dummy client with localStorage fallback to prevent crashes and allow testing
  const getStorageData = (key: string) => JSON.parse(localStorage.getItem(`fintrack_${key}`) || '[]');
  const setStorageData = (key: string, data: any) => localStorage.setItem(`fintrack_${key}`, JSON.stringify(data));

  supabase = {
    auth: {
      getSession: async () => {
        const user = JSON.parse(localStorage.getItem('fintrack_user') || 'null');
        return { data: { session: user ? { user } : null }, error: null };
      },
      onAuthStateChange: (callback: any) => {
        const user = JSON.parse(localStorage.getItem('fintrack_user') || 'null');
        callback('SIGNED_IN', user ? { user } : null);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: async ({ email }: any) => {
        const user = { id: 'dummy-user', email };
        localStorage.setItem('fintrack_user', JSON.stringify(user));
        return { data: { user, session: { user } }, error: null };
      },
      signUp: async ({ email }: any) => {
        const user = { id: 'dummy-user', email };
        localStorage.setItem('fintrack_user', JSON.stringify(user));
        return { data: { user, session: { user } }, error: null };
      },
      signOut: async () => {
        localStorage.removeItem('fintrack_user');
      },
    },
    from: (table: string) => ({
      select: (columns: string = '*') => {
        const data = getStorageData(table);
        const chain = {
          data,
          eq: (column: string, value: any) => {
            chain.data = chain.data.filter((d: any) => d[column] === value);
            return chain;
          },
          in: (column: string, values: any[]) => {
            chain.data = chain.data.filter((d: any) => values.includes(d[column]));
            return chain;
          },
          order: (column: string, { ascending = true } = {}) => {
            chain.data = [...chain.data].sort((a: any, b: any) => {
              if (a[column] < b[column]) return ascending ? -1 : 1;
              if (a[column] > b[column]) return ascending ? 1 : -1;
              return 0;
            });
            return chain;
          },
          single: () => {
            const result = chain.data.length > 0 ? chain.data[0] : null;
            return Promise.resolve({ data: result, error: null });
          },
          then: (resolve: any) => resolve({ data: chain.data, error: null }),
          // Support for direct await
          catch: (reject: any) => Promise.resolve({ data: chain.data, error: null }).catch(reject),
          finally: (cb: any) => Promise.resolve({ data: chain.data, error: null }).finally(cb)
        };
        // Make it a thenable to support await directly on select() or after filters
        return chain as any;
      },
      insert: (data: any[]) => {
        const existing = getStorageData(table);
        const newData = [...existing, ...data.map(d => ({ ...d, id: d.id || crypto.randomUUID() }))];
        setStorageData(table, newData);
        return Promise.resolve({ error: null });
      },
      update: (data: any) => ({ 
        eq: (column: string, value: any) => {
          const existing = getStorageData(table);
          const updated = existing.map((d: any) => d[column] === value ? { ...d, ...data } : d);
          setStorageData(table, updated);
          return Promise.resolve({ error: null });
        }
      }),
      delete: () => ({ 
        eq: (column: string, value: any) => {
          const existing = getStorageData(table);
          const filtered = existing.filter((d: any) => d[column] !== value);
          setStorageData(table, filtered);
          return Promise.resolve({ error: null });
        }
      }),
      upsert: (data: any) => {
        const existing = getStorageData(table);
        const dataToUpsert = Array.isArray(data) ? data : [data];
        
        let updated = [...existing];
        dataToUpsert.forEach(item => {
          // Try to find by id or user_id
          const index = updated.findIndex((d: any) => 
            (item.id && d.id === item.id) || 
            (item.user_id && d.user_id === item.user_id)
          );
          
          if (index >= 0) {
            updated[index] = { ...updated[index], ...item };
          } else {
            updated.push({ ...item, id: item.id || crypto.randomUUID() });
          }
        });
        
        setStorageData(table, updated);
        return Promise.resolve({ error: null });
      },
    }),
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: 'dummy' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://picsum.photos/200' } }),
      })
    }
  };
}

export { supabase };
