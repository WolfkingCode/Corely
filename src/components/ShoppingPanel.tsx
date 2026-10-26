import { useState, useMemo } from 'react';
import { Plus, Trash2, ShoppingCart, Check } from 'lucide-react';
import { AppSettings, TaskItem } from '../types';

interface ShoppingPanelProps {
  shopping: TaskItem[];
  onAddTask: (
    type: 'todos' | 'shopping',
    text: string,
    priority?: 'urgent' | 'important' | 'normal',
    category?: string,
    quantity?: number,
    unit?: string
  ) => void;
  onToggleTask: (type: 'todos' | 'shopping', idx: number) => void;
  onDeleteTask: (type: 'todos' | 'shopping', idx: number) => void;
  settings?: AppSettings;
}

const QUICK_CATEGORIES_FA = ['خوار و بار', 'لبنیات', 'میوه و سبزی', 'بهداشتی', 'سایر'];
const QUICK_CATEGORIES_EN = ['Groceries', 'Dairy', 'Produce', 'Household', 'Other'];

export default function ShoppingPanel({ shopping, onAddTask, onToggleTask, onDeleteTask, settings }: ShoppingPanelProps) {
  const isEn = settings?.language === 'en';
  const quickCategories = isEn ? QUICK_CATEGORIES_EN : QUICK_CATEGORIES_FA;
  const [newText, setNewText] = useState('');
  const [newQuantity, setNewQuantity] = useState<number | ''>('');
  const [newUnit, setNewUnit] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(quickCategories[0]);

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAddTask(
      'shopping',
      trimmed,
      'normal',
      selectedCategory,
      newQuantity === '' ? undefined : Number(newQuantity),
      newUnit.trim() || undefined
    );
    setNewText('');
    setNewQuantity('');
    setNewUnit('');
  };

  // Group items by category, preserving original index for toggle/delete calls
  const grouped = useMemo(() => {
    const map = new Map<string, { item: TaskItem; idx: number }[]>();
    shopping.forEach((item, idx) => {
      const cat = item.category || (isEn ? 'Other' : 'سایر');
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ item, idx });
    });
    return Array.from(map.entries());
  }, [shopping, isEn]);

  const doneCount = shopping.filter(s => s.done).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-[var(--text)]">{isEn ? 'Shopping List' : 'لیست خرید'}</h2>
            <p className="text-[11px] text-[var(--text3)]">
              {isEn ? `${doneCount} of ${shopping.length} in cart` : `${doneCount} از ${shopping.length} توی سبد`}
            </p>
          </div>
        </div>
      </div>

      {/* Add new item */}
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={isEn ? 'Add an item (e.g. Bread)' : 'یه آیتم اضافه کن (مثلاً نان)'}
            className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-[var(--text3)] text-[var(--text)]"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              min="0"
              step="any"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder={isEn ? 'Qty' : 'تعداد'}
              className="w-16 px-2 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-xs text-center outline-none placeholder:text-[var(--text3)] text-[var(--text)] focus:border-blue-500 transition-colors"
            />
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder={isEn ? 'kg, pack, pcs' : 'کیلو، بسته، عدد'}
              className="w-24 sm:w-28 px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-xs outline-none placeholder:text-[var(--text3)] text-[var(--text)] focus:border-blue-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
              title={isEn ? 'Add' : 'افزودن'}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped list */}
      {shopping.length === 0 ? (
        <div className="text-center py-10 text-[var(--text3)] text-sm">
          {isEn ? 'Your shopping list is empty' : 'لیست خریدت خالیه'}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-bold text-[var(--text2)] mb-2 px-1">{category}</h3>
              <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] divide-y divide-[var(--border)] overflow-hidden">
                {items.map(({ item, idx }) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => onToggleTask('shopping', idx)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        item.done
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-[var(--border-hover)]'
                      }`}
                    >
                      {item.done && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className={`text-sm ${item.done ? 'line-through text-[var(--text3)]' : 'text-[var(--text)]'}`}>
                        {item.text}
                      </span>
                      {(item.quantity !== undefined && item.quantity !== null || item.unit) && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium shrink-0 ${
                          item.done
                            ? 'bg-transparent text-[var(--text3)] opacity-60'
                            : 'bg-[var(--input-bg)] text-[var(--text2)] border border-[var(--border)]'
                        }`}>
                          {[item.quantity, item.unit].filter(v => v !== undefined && v !== null && v !== '').join(' ')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteTask('shopping', idx)}
                      className="text-[var(--text3)] hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
