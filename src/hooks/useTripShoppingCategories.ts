import * as React from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ShoppingListService } from '../services/ShoppingListService';
import {
  SHOPPING_CATEGORIES_CHANGED_EVENT,
  deleteTripShoppingCategory,
  loadTripShoppingCategories,
  rememberTripShoppingCategory,
  renameTripShoppingCategory
} from '../utils/tripShoppingCategories';

export function useTripShoppingCategories(
  tripId: string | undefined,
  spContext?: WebPartContext
): {
  categories: string[];
  addCategory: (name: string) => string[];
  renameCategory: (oldName: string, newName: string) => Promise<string[]>;
  deleteCategory: (name: string) => Promise<string[]>;
  reload: () => void;
} {
  const [categories, setCategories] = React.useState<string[]>([]);

  const reload = React.useCallback(() => {
    setCategories(tripId ? loadTripShoppingCategories(tripId) : []);
  }, [tripId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    const onChanged = (event: Event): void => {
      const detail = (event as CustomEvent<{ tripId: string }>).detail;
      if (tripId && detail?.tripId === tripId) reload();
    };
    window.addEventListener(SHOPPING_CATEGORIES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SHOPPING_CATEGORIES_CHANGED_EVENT, onChanged);
  }, [tripId, reload]);

  const addCategory = React.useCallback(
    (name: string): string[] => {
      if (!tripId) return [];
      const next = rememberTripShoppingCategory(tripId, name);
      setCategories(next);
      return next;
    },
    [tripId]
  );

  const renameCategory = React.useCallback(
    async (oldName: string, newName: string): Promise<string[]> => {
      if (!tripId) return [];
      const next = renameTripShoppingCategory(tripId, oldName, newName);
      setCategories(next);
      if (spContext) {
        const svc = new ShoppingListService(spContext);
        const items = await svc.getForTrip(tripId);
        await Promise.all(
          items
            .filter((item) => item.category.trim().toLowerCase() === oldName.trim().toLowerCase())
            .map((item) => svc.update(item.id, { category: newName.trim() }))
        );
      }
      return next;
    },
    [tripId, spContext]
  );

  const deleteCategory = React.useCallback(
    async (name: string): Promise<string[]> => {
      if (!tripId) return [];
      const next = deleteTripShoppingCategory(tripId, name);
      setCategories(next);
      if (spContext) {
        const svc = new ShoppingListService(spContext);
        const items = await svc.getForTrip(tripId);
        await Promise.all(
          items
            .filter((item) => item.category.trim().toLowerCase() === name.trim().toLowerCase())
            .map((item) => svc.update(item.id, { category: '' }))
        );
      }
      return next;
    },
    [tripId, spContext]
  );

  return { categories, addCategory, renameCategory, deleteCategory, reload };
}
