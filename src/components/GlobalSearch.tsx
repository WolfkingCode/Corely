/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useDeferredValue, useCallback } from 'react';
import {
  Search,
  Lightbulb,
  FileText,
  CheckSquare,
  ShoppingCart,
  Clapperboard,
  Package,
  Coins,
  CornerDownLeft,
  X,
  LayoutGrid,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Idea, TaskItem, Transaction, EditAsset, EditPackage } from '../types';

type GroupKey = 'app' | 'ideas' | 'notes' | 'tasks' | 'shopping' | 'assets' | 'packages' | 'finance';

interface SearchResult {
  key: string;
  group: GroupKey;
  title: string;
  snippet?: string;
  panel: string;
}

interface IndexEntry extends SearchResult {
  hay: string;
  titleHay: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (panel: string) => void;
  isEn: boolean;
  ideas: Idea[];
  todos: TaskItem[];
  shopping: TaskItem[];
  note: string;
  finance: Transaction[];
  maskAmounts?: boolean;
}

const GROUP_ORDER: GroupKey[] = ['app', 'ideas', 'notes', 'tasks', 'shopping', 'assets', 'packages', 'finance'];

const GROUP_META: Record<GroupKey, { icon: LucideIcon; en: string; fa: string; color: string }> = {
  app: { icon: LayoutGrid, en: 'App sections & settings', fa: 'بخش‌ها و تنظیمات برنامه', color: 'text-blue-400' },
  ideas: { icon: Lightbulb, en: 'Ideas', fa: 'ایده‌ها', color: 'text-amber-400' },
  notes: { icon: FileText, en: 'Notes', fa: 'یادداشت‌ها', color: 'text-sky-400' },
  tasks: { icon: CheckSquare, en: 'Tasks', fa: 'کارها', color: 'text-emerald-400' },
  shopping: { icon: ShoppingCart, en: 'Shopping', fa: 'خرید', color: 'text-orange-400' },
  assets: { icon: Clapperboard, en: 'Edit assets', fa: 'منابع ادیت', color: 'text-purple-400' },
  packages: { icon: Package, en: 'Packages', fa: 'پکیج‌ها', color: 'text-fuchsia-400' },
  finance: { icon: Coins, en: 'Finance', fa: 'مدیریت مالی', color: 'text-yellow-400' },
};

// Static index of app sections and settings, so searching e.g. "language" shows where to change it.
interface AppEntry {
  panel: string;
  fa: string;
  en: string;
  hintFa: string;
  hintEn: string;
  keywords: string;
}

const APP_ENTRIES: AppEntry[] = [
  { panel: 'home', fa: 'خانه', en: 'Home', hintFa: 'صفحه‌ی اصلی: ساعت، برنامه‌ی امروز، تایمر تمرکز', hintEn: 'Main page: clock, today plan, focus timer', keywords: 'داشبورد پومودورو تمرکز تایمر dashboard pomodoro focus timer clock ساعت' },
  { panel: 'ai', fa: 'دستیار هوشمند', en: 'AI Assistant', hintFa: 'چت با هوش مصنوعی', hintEn: 'Chat with the AI', keywords: 'هوش مصنوعی چت جمینای gemini openai ai chat' },
  { panel: 'note', fa: 'یادداشت‌ها', en: 'Notes', hintFa: 'نوشتن و مرور یادداشت‌ها', hintEn: 'Write and browse notes', keywords: 'یادداشت نوت note notes' },
  { panel: 'ideas', fa: 'ایده‌ها', en: 'Ideas', hintFa: 'ثبت و مدیریت ایده‌ها', hintEn: 'Capture and manage ideas', keywords: 'ایده idea ideas' },
  { panel: 'tasks', fa: 'کارها', en: 'Tasks', hintFa: 'لیست کارهای روزانه', hintEn: 'Your to-do list', keywords: 'تسک کار لیست todo task tasks to-do' },
  { panel: 'shopping', fa: 'لیست خرید', en: 'Shopping list', hintFa: 'لیست خرید', hintEn: 'Your shopping list', keywords: 'خرید shopping list' },
  { panel: 'week', fa: 'برنامه‌ی هفتگی', en: 'Weekly plan', hintFa: 'برنامه‌ریزی هفته', hintEn: 'Plan your week', keywords: 'هفتگی برنامه روزانه هفته weekly plan schedule' },
  { panel: 'edit_assets', fa: 'منابع ادیت', en: 'Editing Assets', hintFa: 'ویدیو، صدا، تصویر، پکیج‌ها و دسته‌بندی‌ها', hintEn: 'Videos, sounds, images, packages and categories', keywords: 'منابع ادیت میم ساند افکت گرین اسکرین پکیج دسته‌بندی ویدیو صدا تصویر edit assets meme video sound image package category' },
  { panel: 'finance', fa: 'مدیریت مالی', en: 'Financial Management', hintFa: 'تراکنش‌ها، بودجه و پس‌انداز', hintEn: 'Transactions, budget and savings', keywords: 'مالی پول تراکنش بودجه پس انداز درآمد هزینه finance money budget income expense savings' },
  { panel: 'downloads', fa: 'دانلود منیجر', en: 'Download Manager', hintFa: 'مدیریت دانلودها', hintEn: 'Manage downloads', keywords: 'دانلود منیجر دانلودر download manager downloader' },
  { panel: 'dns', fa: 'تغییر DNS', en: 'DNS Changer', hintFa: 'تغییر دی‌ان‌اس شبکه', hintEn: 'Change your network DNS', keywords: 'دی ان اس دیان اس شبکه اینترنت dns network internet' },
  { panel: 'settings:general', fa: 'زبان برنامه', en: 'App language', hintFa: 'تنظیمات ← عمومی ← زبان برنامه (فارسی / انگلیسی)', hintEn: 'Settings › General › App language (Persian / English)', keywords: 'زبان فارسی انگلیسی language persian english farsi' },
  { panel: 'settings:general', fa: 'تقویم (شمسی / میلادی)', en: 'Calendar (Jalali / Gregorian)', hintFa: 'تنظیمات ← عمومی ← تقویم اصلی', hintEn: 'Settings › General › Primary calendar', keywords: 'تقویم شمسی میلادی تاریخ زمان calendar jalali shamsi gregorian date time' },
  { panel: 'settings:general', fa: 'نام کاربری', en: 'Profile name', hintFa: 'تنظیمات ← عمومی ← نام کاربری', hintEn: 'Settings › General › Profile name', keywords: 'نام اسم پروفایل کاربری name profile username' },
  { panel: 'settings:general', fa: 'صدا و افکت‌های صوتی', en: 'Sounds & sound effects', hintFa: 'تنظیمات ← عمومی ← صدا', hintEn: 'Settings › General › Sound', keywords: 'صدا افکت صوتی بی صدا sound audio effects mute' },
  { panel: 'settings:general', fa: 'مخفی‌سازی مبالغ مالی', en: 'Hide financial amounts', hintFa: 'تنظیمات ← عمومی ← مخفی‌سازی پیش‌فرض مبالغ', hintEn: 'Settings › General › Hide amounts by default', keywords: 'مخفی حریم خصوصی مبالغ پنهان privacy hide amounts private' },
  { panel: 'settings:ai', fa: 'تنظیمات هوش مصنوعی و کلید API', en: 'AI settings & API key', hintFa: 'تنظیمات ← دستیار هوشمند ← کلید، سرویس‌دهنده و پروکسی', hintEn: 'Settings › AI Assistant › key, provider and proxy', keywords: 'کلید ای پی آی api key جمینای gemini openai پروکسی proxy سرویس دهنده provider مدل model' },
  { panel: 'settings:appearance', fa: 'تم و ظاهر', en: 'Theme & appearance', hintFa: 'تنظیمات ← ظاهر ← تم تاریک/روشن و تصاویر هدف', hintEn: 'Settings › Appearance › dark/light theme and goal images', keywords: 'تم ظاهر تاریک روشن رنگ پس زمینه حذف پس زمینه عکس theme appearance dark light color background' },
  { panel: 'settings:backup', fa: 'پشتیبان‌گیری و بازیابی', en: 'Backup & restore', hintFa: 'تنظیمات ← پشتیبان‌گیری ← بکاپ، بازیابی و خروجی', hintEn: 'Settings › Backup › backup, restore and export', keywords: 'بکاپ پشتیبان بازیابی خروجی اکسپورت ایمپورت backup restore export import csv json' },
  { panel: 'settings:notifications', fa: 'اعلان‌ها و اجرای خودکار', en: 'Notifications & auto-start', hintFa: 'تنظیمات ← اعلان‌ها ← اعلان و اجرا با ویندوز', hintEn: 'Settings › Notifications › alerts and start with Windows', keywords: 'اعلان نوتیفیکیشن اتواستارت اجرای خودکار ویندوز استارتاپ notification notifications autostart auto start startup windows' },
  { panel: 'settings:system', fa: 'آمار سیستم و ریست کامل', en: 'System stats & full reset', hintFa: 'تنظیمات ← آمار سیستم ← آمار و پاک کردن همه‌ی داده‌ها', hintEn: 'Settings › System Stats › stats and erase all data', keywords: 'آمار سیستم ریست پاک کردن داده ها حذف همه system stats reset erase clear data' },
];

const MAX_PER_GROUP = 6;
const MAX_NOTE_LINES = 5000;
const MAX_ASSETS = 30000;

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

// Makes Persian/Arabic text comparable: unifies look-alike letters, digits, and removes half-spaces and diacritics.
const normalize = (value: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ۀ|ة/g, 'ه')
    .replace(/[\u064B-\u065F\u0670\u200c\u200d]/g, '')
    .replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)));

const truncate = (value: string, max: number): string => {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};

const readStorageArray = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

export default function GlobalSearch({
  isOpen,
  onClose,
  onNavigate,
  isEn,
  ideas,
  todos,
  shopping,
  note,
  finance,
  maskAmounts = false,
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);

  // Build the searchable index only while the search window is open.
  const index = useMemo<IndexEntry[]>(() => {
    if (!isOpen) return [];
    const entries: IndexEntry[] = [];
    APP_ENTRIES.forEach((entry, i) => {
      const title = isEn ? entry.en : entry.fa;
      entries.push({
        key: `app-${i}`,
        group: 'app',
        title,
        snippet: isEn ? entry.hintEn : entry.hintFa,
        panel: entry.panel,
        hay: normalize([entry.fa, entry.en, entry.hintFa, entry.hintEn, entry.keywords].join(' ')),
        titleHay: normalize(`${entry.fa} ${entry.en} ${entry.keywords}`),
      });
    });
    const add = (result: SearchResult, fields: Array<string | undefined>) => {
      entries.push({
        ...result,
        hay: normalize(fields.filter(Boolean).join(' ')),
        titleHay: normalize(result.title),
      });
    };

    ideas.forEach(idea => {
      const comments = (idea.comments || []).map(c => c.text);
      add(
        {
          key: `idea-${idea.id}`,
          group: 'ideas',
          title: idea.title || (isEn ? 'Untitled idea' : 'ایده بدون عنوان'),
          snippet: truncate(idea.desc, 100) || undefined,
          panel: 'ideas',
        },
        [idea.title, idea.desc, ...comments]
      );
    });

    (note || '')
      .split(/\r?\n/)
      .slice(0, MAX_NOTE_LINES)
      .forEach((line, i) => {
        const text = line.trim();
        if (!text) return;
        add({ key: `note-${i}`, group: 'notes', title: truncate(text, 110), panel: 'note' }, [text]);
      });

    todos.forEach((task, i) => {
      add(
        {
          key: `todo-${i}`,
          group: 'tasks',
          title: task.text,
          snippet: task.done ? (isEn ? 'Done' : 'انجام‌شده') : undefined,
          panel: 'tasks',
        },
        [task.text, task.category]
      );
    });

    shopping.forEach((item, i) => {
      add(
        {
          key: `shop-${i}`,
          group: 'shopping',
          title: item.text,
          snippet: [item.category, item.quantity ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}` : '']
            .filter(Boolean)
            .join(' • ') || undefined,
          panel: 'shopping',
        },
        [item.text, item.category]
      );
    });

    const assets = readStorageArray<EditAsset>('v3_edit_assets').slice(0, MAX_ASSETS);
    const packageCounts = new Map<string, number>();
    const typeLabel = (type: string) =>
      type === 'video' ? (isEn ? 'Video' : 'ویدیو') : type === 'audio' ? (isEn ? 'Audio' : 'صوت') : isEn ? 'Image' : 'تصویر';

    assets.forEach(asset => {
      if (!asset || typeof asset !== 'object') return;
      if (asset.packageId) {
        packageCounts.set(asset.packageId, (packageCounts.get(asset.packageId) || 0) + 1);
      }
      const title = asset.title || asset.fileName || '';
      if (!title) return;
      add(
        {
          key: `asset-${asset.id}`,
          group: 'assets',
          title,
          snippet: [typeLabel(asset.type), asset.category, asset.fileName && asset.fileName !== title ? asset.fileName : '']
            .filter(Boolean)
            .join(' • '),
          panel: 'edit_assets',
        },
        [asset.title, asset.fileName, asset.category, ...(Array.isArray(asset.tags) ? asset.tags : [])]
      );
    });

    readStorageArray<EditPackage>('v3_edit_packages').forEach(pkg => {
      if (!pkg || !pkg.name) return;
      const count = packageCounts.get(pkg.id) || 0;
      add(
        {
          key: `pkg-${pkg.id}`,
          group: 'packages',
          title: pkg.name,
          snippet: isEn ? `${count} items` : `${count} مورد`,
          panel: 'edit_assets',
        },
        [pkg.name]
      );
    });

    finance.forEach(tx => {
      const amountText = maskAmounts ? '***' : tx.amount.toLocaleString(isEn ? 'en-US' : 'fa-IR');
      add(
        {
          key: `fin-${tx.id}`,
          group: 'finance',
          title: tx.desc || tx.category,
          snippet: `${tx.type === 'income' ? '+' : '-'}${amountText} • ${tx.category} • ${tx.jy}/${tx.jm}/${tx.jd}`,
          panel: 'finance',
        },
        [tx.desc, tx.category, maskAmounts ? '' : String(tx.amount), `${tx.jy}/${tx.jm}/${tx.jd}`]
      );
    });

    return entries;
  }, [isOpen, ideas, todos, shopping, note, finance, isEn, maskAmounts]);

  const { flat, groups } = useMemo(() => {
    const tokens = normalize(deferredQuery).split(/\s+/).filter(Boolean);
    const empty = { flat: [] as SearchResult[], groups: [] as Array<{ group: GroupKey; items: SearchResult[]; total: number }> };
    if (tokens.length === 0) return empty;

    const titleHits = new Map<GroupKey, SearchResult[]>();
    const otherHits = new Map<GroupKey, SearchResult[]>();

    for (const entry of index) {
      if (!tokens.every(t => entry.hay.includes(t))) continue;
      const isTitleHit = tokens.every(t => entry.titleHay.includes(t));
      const target = isTitleHit ? titleHits : otherHits;
      const list = target.get(entry.group);
      const result: SearchResult = {
        key: entry.key,
        group: entry.group,
        title: entry.title,
        snippet: entry.snippet,
        panel: entry.panel,
      };
      if (list) list.push(result);
      else target.set(entry.group, [result]);
    }

    const resultGroups: Array<{ group: GroupKey; items: SearchResult[]; total: number }> = [];
    const flatList: SearchResult[] = [];
    for (const group of GROUP_ORDER) {
      const all = [...(titleHits.get(group) || []), ...(otherHits.get(group) || [])];
      if (all.length === 0) continue;
      const items = all.slice(0, MAX_PER_GROUP);
      resultGroups.push({ group, items, total: all.length });
      flatList.push(...items);
    }
    return { flat: flatList, groups: resultGroups };
  }, [index, deferredQuery]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelected(0);
      const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelected(0);
  }, [deferredQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const openResult = useCallback(
    (result: SearchResult) => {
      onNavigate(result.panel);
      onClose();
    },
    [onNavigate, onClose]
  );

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flat.length > 0) setSelected(prev => (prev + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length > 0) setSelected(prev => (prev - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flat[selected];
      if (target) openResult(target);
    }
  };

  if (!isOpen) return null;

  const hasQuery = deferredQuery.trim().length > 0;
  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh] bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Search' : 'جستجو'}
    >
      <div
        dir={isEn ? 'ltr' : 'rtl'}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--text3)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={isEn ? 'Search notes, ideas, tasks, settings, language…' : 'جستجو در یادداشت‌ها، ایده‌ها، کارها، تنظیمات، زبان…'}
            className="flex-1 bg-transparent outline-none text-sm text-[var(--text)] placeholder:text-[var(--text3)]"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-md text-[10px] bg-[var(--input-bg)] text-[var(--text3)] border border-[var(--border)]">
            Esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close search' : 'بستن جستجو'}
            title={isEn ? 'Close (Esc)' : 'بستن (Esc)'}
            className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
          {!hasQuery && (
            <div className="px-4 py-8 text-center text-xs text-[var(--text3)] leading-6">
              {isEn
                ? 'Type to search your data and the app itself: ideas, notes, tasks, assets, packages, finances, sections and settings (e.g. "language").'
                : 'برای جستجو تایپ کنید: ایده‌ها، یادداشت‌ها، کارها، منابع ادیت، پکیج‌ها، مالی و حتی بخش‌ها و تنظیمات اپ (مثلاً «زبان»).'}
            </div>
          )}

          {hasQuery && groups.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-[var(--text3)]">
              {isEn ? 'No results found.' : 'نتیجه‌ای پیدا نشد.'}
            </div>
          )}

          {groups.map(({ group, items, total }) => {
            const meta = GROUP_META[group];
            const Icon = meta.icon;
            return (
              <div key={group} className="py-1">
                <div className="flex items-center justify-between px-4 py-1.5 text-[11px] font-semibold text-[var(--text3)]">
                  <span className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                    {isEn ? meta.en : meta.fa}
                  </span>
                  <span>
                    {total > items.length
                      ? isEn
                        ? `${items.length} of ${total}`
                        : `${items.length} از ${total}`
                      : total}
                  </span>
                </div>
                {items.map(result => {
                  runningIndex += 1;
                  const itemIndex = runningIndex;
                  const isSelected = itemIndex === selected;
                  return (
                    <button
                      key={result.key}
                      type="button"
                      data-index={itemIndex}
                      onClick={() => openResult(result)}
                      onMouseMove={() => {
                        if (selected !== itemIndex) setSelected(itemIndex);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-start transition-colors cursor-pointer ${
                        isSelected ? 'bg-[var(--sidebar-hover)]' : 'hover:bg-[var(--sidebar-hover)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div dir="auto" className="text-xs font-semibold text-[var(--text)] truncate">
                          {result.title}
                        </div>
                        {result.snippet && (
                          <div dir="auto" className="text-[11px] text-[var(--text3)] truncate mt-0.5">
                            {result.snippet}
                          </div>
                        )}
                      </div>
                      {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-[var(--text3)] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-[var(--border)] text-[10px] text-[var(--text3)]">
          <span>{isEn ? '↑ ↓ to move · Enter to open' : '↑ ↓ برای حرکت · Enter برای باز کردن'}</span>
          <span>Ctrl + K</span>
        </div>
      </div>
    </div>
  );
}
