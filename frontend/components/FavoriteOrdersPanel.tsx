'use client';

import React, { useEffect, useState } from 'react';
import { fetchFavoriteOrders, createFavoriteOrder, deleteFavoriteOrder, type FavoriteOrderItem } from '../lib/api-stickiness';

interface FavoriteOrder {
  id: number;
  attributes?: Record<string, unknown>;
  name?: string;
  items?: FavoriteOrderItem[];
}

interface FavoriteOrdersPanelProps {
  onApply?: (items: FavoriteOrderItem[]) => void;
  /** Items actuales para guardar como favorito */
  currentItems?: FavoriteOrderItem[];
  className?: string;
}

/**
 * Panel FavoriteOrders - diagnósticos, tratamientos y recetas frecuentes.
 * Se muestra dentro de QuickOrders.
 */
export function FavoriteOrdersPanel({
  onApply,
  currentItems = [],
  className = '',
}: FavoriteOrdersPanelProps) {
  const [favorites, setFavorites] = useState<FavoriteOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchFavoriteOrders()
      .then((data) => setFavorites(Array.isArray(data) ? data : []))
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false));
  }, []);

  const normalize = (f: any): FavoriteOrder => ({
    id: f.id,
    attributes: f.attributes ?? f,
    name: f.attributes?.name ?? f.name,
    items: f.attributes?.items ?? f.items ?? [],
  });

  const handleApply = (f: FavoriteOrder) => {
    const items = normalize(f).items ?? [];
    onApply?.(items);
  };

  const handleSaveCurrent = async () => {
    const name = prompt('Nombre del favorito (ej: Hypertension basic treatment)');
    if (!name?.trim() || currentItems.length === 0) return;
    setSaving(true);
    try {
      await createFavoriteOrder({ name: name.trim(), items: currentItems });
      fetchFavoriteOrders().then((data) => setFavorites(Array.isArray(data) ? data : []));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteFavoriteOrder(id);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return null;

  const list = favorites.map(normalize);
  if (list.length === 0 && currentItems.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-xs font-medium text-gray-600">Favoritos</h4>
      {list.length > 0 && (
        <ul className="space-y-1">
          {list.map((f) => (
            <li key={f.id} className="flex justify-between items-center group">
              <button
                type="button"
                onClick={() => handleApply(f)}
                className="text-sm text-indigo-600 hover:underline text-left flex-1"
              >
                {f.name}
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(f.id, e)}
                className="text-red-500 text-xs opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {currentItems.length > 0 && (
        <button
          type="button"
          onClick={handleSaveCurrent}
          disabled={saving}
          className="text-xs text-indigo-600 hover:underline"
        >
          Guardar actual como favorito
        </button>
      )}
    </div>
  );
}
