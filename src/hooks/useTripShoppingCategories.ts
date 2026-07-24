import * as React from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ShoppingListService } from '../services/ShoppingListService';
import { PackingService } from '../services/PackingService';
import {
  SHOPPING_CATEGORIES_CHANGED_EVENT,
  deleteTripShoppingCategory,
  loadTripShoppingCategories,
  rememberTripShoppingCategory,
  renameTripShoppingCategory,
  restoreDefaultListCategories
} from '../utils/tripShoppingCategories';

/** Shared packing + shopping category taxonomy for a trip. */
export function useTripShoppingCategories(
  tripId: string | undefined,
  spContext?: WebPartContext
): {
  categories: string[];
  addCategory: (name: string) => string[];
  renameCategory: (oldName: string, newName: string) => Promise<string[]>;
  deleteCategory: (name: string) => Promise<string[]>;
  restoreDefaults: () => string[];
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
        const shopping = new ShoppingListService(spContext);
        const packing = new PackingService(spContext);
        const [shopItems, packItems] = await Promise.all([
          shopping.getForTrip(tripId),
          packing.getForTrip(tripId)
        ]);
        const oldKey = oldName.trim().toLowerCase();
        const trimmedNew = newName.trim();
        await Promise.all([
          ...shopItems
            .filter((item) => item.category.trim().toLowerCase() === oldKey)
            .map((item) => shopping.update(item.id, { category: trimmedNew })),
          ...packItems
            .filter((item) => (item.category || '').trim().toLowerCase() === oldKey)
            .map((item) => packing.update(item.id, { category: trimmedNew }))
        ]);
      }
      return next;
    },
    [tripId, spContext]
  );

  const deleteCategory = React.useCallback(
    async (name: string): Promise<string[]> => {
      if (!tripId) return [];
      if (spContext) {
        const shopping = new ShoppingListService(spContext);
        const packing = new PackingService(spContext);
        const [shopItems, packItems] = await Promise.all([
          shopping.getForTrip(tripId),
          packing.getForTrip(tripId)
        ]);
        const key = name.trim().toLowerCase();
        const packingUsed = packItems.some((item) => (item.category || '').trim().toLowerCase() === key);
        const shoppingUsed = shopItems.some((item) => item.category.trim().toLowerCase() === key);
        if (packingUsed || shoppingUsed) {
          throw new Error(
            `“${name}” is still used on packing or shopping items. Reassign those items first, then delete.`
          );
        }
      }
      const next = deleteTripShoppingCategory(tripId, name);
      setCategories(next);
      return next;
    },
    [tripId, spContext]
  );

  const restoreDefaults = React.useCallback((): string[] => {
    if (!tripId) return [];
    const next = restoreDefaultListCategories(tripId);
    setCategories(next);
    return next;
  }, [tripId]);

  return { categories, addCategory, renameCategory, deleteCategory, restoreDefaults, reload };
}

export const useTripListCategories = useTripShoppingCategories;
