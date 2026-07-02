import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/supabase';

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  description: string | null;
  image: string | null;
  created_at: string;
}

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refreshCategories: () => Promise<void>;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCategories() {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load categories';
      setError(message);
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  const refreshCategories = async () => {
    await loadCategories();
  };

  return (
    <CategoryContext.Provider value={{ categories, loading, error, refreshCategories }}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }
  return context;
}
