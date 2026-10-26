/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  EyeOff,
  AlertTriangle,
  PieChart,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Trash2,
  Wallet,
  CreditCard,
  Sparkles,
  Utensils,
  Car,
  ShoppingBag,
  Pin,
  Receipt,
  Gamepad2,
  HeartPulse,
  Tag,
  Briefcase,
  Gift,
  Building2,
  X,
  CalendarCheck,
  BarChart3,
  Pencil
} from 'lucide-react';
import { getShamsiParts, SHAMSI_MONTHS, saveToLocalStorage } from '../lib/utils';
import { Transaction, AppSettings, SavingsGoal } from '../types';
import Select from './Select';

interface FinancePanelProps {
  key?: string;
  finance: Transaction[];
  onAddTransaction: (
    type: 'expense' | 'income',
    amount: number,
    category: string,
    desc: string
  ) => void;
  onDeleteTransaction: (id: number) => void;
  settings?: AppSettings;
  savingsGoals?: SavingsGoal[];
  onAddSavingsGoal?: (name: string, targetAmount: number) => void;
  onAddToSavingsGoal?: (id: string, amount: number) => void;
  onDeleteSavingsGoal?: (id: string) => void;
  onToggleGoalPin?: (id: string) => void;
  onUpdateSavingsGoal?: (goal: SavingsGoal) => void;
}

const FINANCE_CATEGORIES = {
  expense: ['خوراک', 'حمل‌ونقل', 'خرید', 'قبض‌ها', 'سرگرمی', 'سلامت', 'متفرقه'],
  income: ['حقوق', 'هدیه', 'فروش', 'متفرقه']
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'خوراک': <Utensils className="w-4 h-4" />,
  'حمل‌ونقل': <Car className="w-4 h-4" />,
  'خرید': <ShoppingBag className="w-4 h-4" />,
  'قبض‌ها': <Receipt className="w-4 h-4" />,
  'سرگرمی': <Gamepad2 className="w-4 h-4" />,
  'سلامت': <HeartPulse className="w-4 h-4" />,
  'حقوق': <Briefcase className="w-4 h-4" />,
  'هدیه': <Gift className="w-4 h-4" />,
  'فروش': <Building2 className="w-4 h-4" />,
  'متفرقه': <Tag className="w-4 h-4" />
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  'خوراک': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', bar: 'bg-amber-500' },
  'حمل‌ونقل': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', bar: 'bg-blue-500' },
  'خرید': { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30', bar: 'bg-pink-500' },
  'قبض‌ها': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', bar: 'bg-purple-500' },
  'سرگرمی': { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', bar: 'bg-indigo-500' },
  'سلامت': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-500' },
  'حقوق': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-500' },
  'هدیه': { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', bar: 'bg-rose-500' },
  'فروش': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', bar: 'bg-cyan-500' },
  'متفرقه': { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30', bar: 'bg-gray-500' }
};

export default function FinancePanel({
  finance,
  onAddTransaction,
  onDeleteTransaction,
  settings,
  savingsGoals = [],
  onAddSavingsGoal,
  onAddToSavingsGoal,
  onDeleteSavingsGoal,
  onToggleGoalPin,
  onUpdateSavingsGoal
}: FinancePanelProps) {
  const [financeType, setFinanceType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(FINANCE_CATEGORIES.expense[0]);
  const [desc, setDesc] = useState('');
  const [monthOffset, setMonthOffset] = useState(0);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalSaved, setEditingGoalSaved] = useState('');
  const [, setGoalsRevision] = useState(0);
  const [goalDeposits, setGoalDeposits] = useState<Record<string, string>>({});
  const [isGoalsSectionOpen, setIsGoalsSectionOpen] = useState(false);

  const handleToggleGoalForm = () => {
    if (isGoalFormOpen) {
      setIsGoalFormOpen(false);
      setEditingGoalId(null);
      setNewGoalName('');
      setNewGoalTarget('');
      setEditingGoalSaved('');
    } else {
      setEditingGoalId(null);
      setNewGoalName('');
      setNewGoalTarget('');
      setEditingGoalSaved('');
      setIsGoalFormOpen(true);
    }
  };

  const handleStartEditGoal = (goal: SavingsGoal) => {
    setIsGoalsSectionOpen(true);
    setEditingGoalId(goal.id);
    setNewGoalName(goal.name);
    setNewGoalTarget(String(goal.targetAmount));
    setEditingGoalSaved(String(goal.currentAmount));
    setIsGoalFormOpen(true);
  };

  const handleCancelGoalForm = () => {
    setIsGoalFormOpen(false);
    setEditingGoalId(null);
    setNewGoalName('');
    setNewGoalTarget('');
    setEditingGoalSaved('');
  };

  const handleSaveGoal = () => {
    const target = Number(newGoalTarget);
    if (!newGoalName.trim() || !target || target <= 0) return;

    if (editingGoalId) {
      const existing = savingsGoals.find((g) => g.id === editingGoalId);
      if (existing) {
        existing.name = newGoalName.trim();
        existing.targetAmount = target;
        const savedVal = editingGoalSaved.trim() !== '' ? Number(editingGoalSaved) : existing.currentAmount;
        if (!isNaN(savedVal) && savedVal >= 0) {
          existing.currentAmount = savedVal;
        }
        saveToLocalStorage('v3_savings_goals', savingsGoals);
        onUpdateSavingsGoal?.(existing);
        setGoalsRevision((r) => r + 1);
      }
    } else {
      onAddSavingsGoal?.(newGoalName.trim(), target);
    }

    setNewGoalName('');
    setNewGoalTarget('');
    setEditingGoalSaved('');
    setEditingGoalId(null);
    setIsGoalFormOpen(false);
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Local state for toggling privacy mask
  const [isMasked, setIsMasked] = useState<boolean>(() => Boolean(settings?.privacyMode));

  // Determine current viewing month (Shamsi)
  const getViewingShamsiDate = () => {
    const curSp = getShamsiParts(new Date());
    const totalMonths = curSp.jy * 12 + (curSp.jm - 1) + monthOffset;
    const jy = Math.floor(totalMonths / 12);
    const jm = (totalMonths % 12) + 1;
    return { jy, jm };
  };

  const currentViewing = getViewingShamsiDate();

  // Filter transactions for currently selected Shamsi month & year
  const monthlyTransactions = finance.filter(
    (t) => t.jy === currentViewing.jy && t.jm === currentViewing.jm
  );

  const totalIncome = monthlyTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = monthlyTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  // Filtered transactions list
  const filteredTransactions = monthlyTransactions
    .filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (selectedCategoryFilter !== 'all' && t.category !== selectedCategoryFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchCat = t.category.toLowerCase().includes(query);
        const matchDesc = t.desc?.toLowerCase().includes(query);
        const matchAmt = t.amount.toString().includes(query);
        return matchCat || matchDesc || matchAmt;
      }
      return true;
    })
    .sort((a, b) => b.id - a.id);

  // Category breakdown calculation
  const categoryExpenses: Record<string, number> = {};
  monthlyTransactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.amount;
    });

  const sortedCategories = Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1]);

  const handleTypeChange = (type: 'expense' | 'income') => {
    setFinanceType(type);
    setCategory(FINANCE_CATEGORIES[type][0]);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    onAddTransaction(financeType, amt, category, desc);
    
    // Clear inputs
    setAmount('');
    setDesc('');
    setMonthOffset(0); // Reset filter to current month
    setIsFormOpen(false);
  };

  const formattedAmountPreview = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return null;
    return `${num.toLocaleString('fa-IR')} تومان`;
  };

  const isEn = settings?.language === 'en';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-8"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--border)] shadow-xs">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl p-1">
            <button 
              className="p-1.5 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition cursor-pointer"
              onClick={() => setMonthOffset((prev) => prev - 1)}
              title={isEn ? 'Previous Month' : 'ماه قبل'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            
            <div className="px-3 py-1 flex items-center gap-2 min-w-[120px] justify-center">
              <CalendarCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-xs font-bold text-[var(--text)]">
                {SHAMSI_MONTHS[currentViewing.jm - 1]} {currentViewing.jy}
              </span>
            </div>

            <button 
              className="p-1.5 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition cursor-pointer"
              onClick={() => setMonthOffset((prev) => prev + 1)}
              title={isEn ? 'Next Month' : 'ماه بعد'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {monthOffset !== 0 && (
            <button
              onClick={() => setMonthOffset(0)}
              className="px-2.5 py-1.5 text-[11px] font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl transition cursor-pointer"
            >
              {isEn ? 'Current Month' : 'ماه جاری'}
            </button>
          )}
        </div>

        {/* Right Actions: Privacy toggle & Add transaction */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsMasked(!isMasked)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              isMasked 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                : 'bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{isMasked ? (isEn ? 'Show Amounts' : 'مخفی‌سازی مبالغ') : (isEn ? 'Hide Amounts' : 'نمایش مبالغ')}</span>
          </button>

          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer"
          >
            {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isFormOpen ? (isEn ? 'Close Form' : 'بستن فرم') : (isEn ? 'New Transaction' : 'تراکنش جدید')}</span>
          </button>
        </div>
      </div>

      {/* Savings Goals */}
      <div className="rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsGoalsSectionOpen(!isGoalsSectionOpen)}
          className="w-full flex items-center justify-between p-3 cursor-pointer"
        >
          <h3 className="text-xs font-bold text-[var(--text)] flex items-center gap-2">
            <Wallet className="w-4 h-4 text-purple-400" />
            {isEn ? 'Purchase Goals' : 'اهداف خرید'}
            {savingsGoals.length > 0 && (
              <span className="text-[10px] text-[var(--text3)] font-normal">({savingsGoals.length})</span>
            )}
          </h3>
          <ChevronDown className={`w-4 h-4 text-[var(--text3)] transition-transform ${isGoalsSectionOpen ? 'rotate-180' : ''}`} />
        </button>

        {isGoalsSectionOpen && (
        <div className="p-3 pt-0 space-y-2">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleToggleGoalForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer"
          >
            {isGoalFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>
              {isGoalFormOpen
                ? (isEn ? 'Close Form' : 'بستن فرم')
                : (isEn ? 'New Goal' : 'هدف جدید')}
            </span>
          </button>
        </div>

        {isGoalFormOpen && (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)]">
            {editingGoalId && (
              <div className="text-[11px] font-bold text-purple-400">
                {isEn ? 'Edit Goal' : 'ویرایش هدف'}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                placeholder={isEn ? 'Goal name (e.g. iPhone 15)' : 'اسم هدف (مثلاً آیفون ۱۵)'}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-purple-500"
              />
              <input
                type="number"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                placeholder={isEn ? 'Target amount' : 'مبلغ هدف'}
                className="no-spinner w-full sm:w-40 px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-purple-500 font-mono"
              />
              {editingGoalId && (
                <input
                  type="number"
                  value={editingGoalSaved}
                  onChange={(e) => setEditingGoalSaved(e.target.value)}
                  placeholder={isEn ? 'Saved amount' : 'مبلغ پس‌انداز'}
                  className="no-spinner w-full sm:w-40 px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-purple-500 font-mono"
                />
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer shrink-0"
                >
                  {editingGoalId ? (isEn ? 'Save' : 'ذخیره') : (isEn ? 'Create' : 'ساخت')}
                </button>
                {editingGoalId && (
                  <button
                    type="button"
                    onClick={handleCancelGoalForm}
                    className="px-3 py-2 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text2)] transition cursor-pointer shrink-0"
                  >
                    {isEn ? 'Cancel' : 'انصراف'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {savingsGoals.length === 0 ? (
          <p className="text-xs text-[var(--text3)] text-center py-2">
            {isEn ? 'No purchase goals yet.' : 'هنوز هدف خریدی نساختی.'}
          </p>
        ) : (
          <div className="space-y-2">
            {savingsGoals.map(goal => {
              const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
              const isDone = goal.currentAmount >= goal.targetAmount;
              return (
                <div key={goal.id} className="p-3 rounded-xl bg-[var(--card-bg)] border border-purple-500/30 shadow-md space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onToggleGoalPin?.(goal.id)}
                      title={isEn ? 'Pin to Home' : 'سنجاق به خانه'}
                      className={`shrink-0 transition cursor-pointer ${goal.pinnedHome ? 'text-purple-400' : 'text-[var(--text3)] hover:text-purple-400'}`}
                    >
                      <Pin className="w-3.5 h-3.5" fill={goal.pinnedHome ? 'currentColor' : 'none'} />
                    </button>
                    <span className="flex-1 text-center text-xs font-bold text-[var(--text)]">
                      {isEn ? `Goal: ${goal.name}` : `هدف: ${goal.name}`}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditGoal(goal)}
                        title={isEn ? 'Edit Goal' : 'ویرایش هدف'}
                        className="text-[var(--text3)] hover:text-purple-400 cursor-pointer transition shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingGoalId === goal.id) {
                            handleCancelGoalForm();
                          }
                          onDeleteSavingsGoal?.(goal.id);
                        }}
                        title={isEn ? 'Delete Goal' : 'حذف هدف'}
                        className="text-red-400 hover:text-red-500 cursor-pointer transition shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="relative h-7 rounded-full bg-[var(--input-bg)] border border-purple-500/30 overflow-hidden">
                    <div
                      className={`absolute inset-y-0 right-0 rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-purple-500'}`}
                      style={{ width: `${percent}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-end pr-0.5">
                      <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                        {percent}%
                      </span>
                    </div>
                  </div>
                  <div className="text-center text-[10px] text-[var(--text3)]">
                    {isMasked ? '****' : goal.currentAmount.toLocaleString(isEn ? 'en-US' : 'fa-IR')} {isEn ? 'of' : 'از'} {isMasked ? '****' : goal.targetAmount.toLocaleString(isEn ? 'en-US' : 'fa-IR')} {isEn ? 'Toman' : 'تومان'} ({percent}%)
                  </div>
                  {isDone ? (
                    <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Ready to buy!' : 'آماده‌ی خریده! 🎉'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={goalDeposits[goal.id] || ''}
                        onChange={(e) => setGoalDeposits(prev => ({ ...prev, [goal.id]: e.target.value }))}
                        placeholder={isEn ? 'Add amount' : 'مبلغ اضافه'}
                        className="no-spinner flex-1 px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-purple-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const amt = Number(goalDeposits[goal.id]);
                          if (!amt || amt <= 0) return;
                          onAddToSavingsGoal?.(goal.id, amt);
                          setGoalDeposits(prev => ({ ...prev, [goal.id]: '' }));
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer shrink-0"
                      >
                        {isEn ? 'Add' : 'افزودن'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
        )}
      </div>

      {/* Income Exceeded Alert */}
      {totalIncome > 0 && totalExpense > totalIncome && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {isEn 
                ? `Warning: This month's expenses exceed recorded income (${isMasked ? '****' : totalIncome.toLocaleString('en-US')} Toman)!` 
                : `هشدار: هزینه‌های این ماه از کل درآمد ثبت‌شده (${isMasked ? '****' : totalIncome.toLocaleString('fa-IR')} تومان) فراتر رفته است!`}
            </span>
          </div>
          <span className="font-mono text-[11px] dir-ltr text-rose-300">
            +{isMasked ? '****' : (totalExpense - totalIncome).toLocaleString(isEn ? 'en-US' : 'fa-IR')} {isEn ? 'Toman Deficit' : 'تومان کسری'}
          </span>
        </div>
      )}

      {/* Executive Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Income Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-[var(--card-bg)] to-[var(--card-bg)] border border-emerald-500/20 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[var(--text2)]">{isEn ? 'Total Income This Month' : 'درآمد کل این ماه'}</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono tracking-tight dir-ltr text-right">
            {isMasked ? '****' : `${totalIncome.toLocaleString(isEn ? 'en-US' : 'fa-IR')} ${isEn ? 'Toman' : 'تومان'}`}
          </div>
          <div className="mt-2 text-[11px] text-[var(--text3)] flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isEn ? `Count: ${monthlyTransactions.filter(t => t.type === 'income').length} txns` : `تعداد: ${monthlyTransactions.filter(t => t.type === 'income').length} تراکنش`}</span>
          </div>
        </div>

        {/* Expense Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-[var(--card-bg)] to-[var(--card-bg)] border border-rose-500/20 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[var(--text2)]">{isEn ? 'Total Expenses This Month' : 'هزینه‌های این ماه'}</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-400 font-mono tracking-tight dir-ltr text-right">
            {isMasked ? '****' : `${totalExpense.toLocaleString(isEn ? 'en-US' : 'fa-IR')} ${isEn ? 'Toman' : 'تومان'}`}
          </div>
          <div className="mt-2 text-[11px] text-[var(--text3)] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
              <span>{isEn ? `Count: ${monthlyTransactions.filter(t => t.type === 'expense').length} txns` : `تعداد: ${monthlyTransactions.filter(t => t.type === 'expense').length} تراکنش`}</span>
            </span>
            {totalIncome > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono">
                {Math.round((totalExpense / totalIncome) * 100)}% {isEn ? 'of income' : 'از درآمد'}
              </span>
            )}
          </div>
        </div>

        {/* Balance Card */}
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${
          balance >= 0 
            ? 'from-purple-500/10 via-indigo-500/5 to-[var(--card-bg)] border-purple-500/30' 
            : 'from-amber-500/10 via-rose-500/5 to-[var(--card-bg)] border-amber-500/30'
        } border shadow-xs relative overflow-hidden`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[var(--text2)]">{isEn ? 'Net Balance' : 'مانده کل (تراز مالی)'}</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              balance >= 0 ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}>
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-xl font-black font-mono tracking-tight dir-ltr text-right ${balance >= 0 ? 'text-purple-400' : 'text-amber-400'}`}>
            {isMasked ? '****' : `${balance >= 0 ? '+' : ''}${balance.toLocaleString(isEn ? 'en-US' : 'fa-IR')} ${isEn ? 'Toman' : 'تومان'}`}
          </div>
          <div className="mt-2 text-[11px] text-[var(--text3)] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{isEn ? `Status: ${balance >= 0 ? 'Surplus' : 'Deficit'}` : `وضعیت: ${balance >= 0 ? 'سود / اندوخته' : 'کسری بودجه'}`}</span>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              balance >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
            }`}>
              {balance >= 0 ? (isEn ? 'Positive' : 'مثبت') : (isEn ? 'Negative' : 'منفی')}
            </span>
          </div>
        </div>
      </div>

      {/* Income-based Expense Consumption Bar */}
      <div className="p-4.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] space-y-3 shadow-xs">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[var(--text)] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span>{isEn ? 'Expense to Income Ratio' : 'نسبت مصرف هزینه به درآمد این ماه'}</span>
          </span>
          <span className="text-[var(--text2)] font-mono text-[11px] dir-ltr">
            {isMasked ? '****' : `${totalExpense.toLocaleString(isEn ? 'en-US' : 'fa-IR')} / ${totalIncome.toLocaleString(isEn ? 'en-US' : 'fa-IR')} ${isEn ? 'Toman' : 'تومان'}`}
          </span>
        </div>

        {totalIncome > 0 ? (
          <>
            <div className="w-full h-3 bg-[var(--input-bg)] rounded-full overflow-hidden border border-[var(--input-border)] p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  (totalExpense / totalIncome) > 0.9 
                    ? 'bg-rose-500 shadow-xs' 
                    : (totalExpense / totalIncome) > 0.7 
                    ? 'bg-amber-500 shadow-xs' 
                    : 'bg-emerald-500 shadow-xs'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, (totalExpense / totalIncome) * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--text3)]">
              <span>
                {totalExpense > totalIncome ? (
                  <span className="text-rose-400 font-medium">
                    {isEn ? `Deficit: ${isMasked ? '****' : (totalExpense - totalIncome).toLocaleString('en-US')} Toman` : `کسری درآمد: ${isMasked ? '****' : (totalExpense - totalIncome).toLocaleString('fa-IR')} تومان`}
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    {isEn ? `Savings: ${isMasked ? '****' : (totalIncome - totalExpense).toLocaleString('en-US')} Toman` : `پس‌انداز این ماه: ${isMasked ? '****' : (totalIncome - totalExpense).toLocaleString('fa-IR')} تومان`}
                  </span>
                )}
              </span>
              <span className="font-mono font-bold text-[var(--text2)]">
                {Math.round((totalExpense / totalIncome) * 100)}% {isEn ? 'Consumed' : 'مصرف شده'}
              </span>
            </div>
          </>
        ) : (
          <div className="text-xs text-[var(--text3)] py-1.5 px-3 bg-[var(--input-bg)] rounded-xl border border-[var(--input-border)] text-center">
            {isEn ? 'No income recorded for this month yet. Enter income to view consumption ratio.' : 'هنوز درآمدی برای این ماه ثبت نشده است. برای مشاهده درصد مصرف هزینه‌ها، ابتدا درآمد خود را ثبت کنید.'}
          </div>
        )}
      </div>

      {/* Expandable Add Transaction Form */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="p-5 rounded-2xl bg-[var(--card-bg)] border border-purple-500/30 shadow-lg space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text)]">{isEn ? 'New Transaction' : 'ثبت تراکنش جدید'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--input-bg)] rounded-xl border border-[var(--input-border)]">
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  financeType === 'expense'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                <span>{isEn ? 'Expense' : 'هزینه'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  financeType === 'income'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>{isEn ? 'Income' : 'درآمد'}</span>
              </button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Amount Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--text2)]">{isEn ? 'Amount (Toman)' : 'مبلغ (تومان)'}</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={isEn ? 'e.g. 50000' : 'مثال: ۵۰۰۰۰'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-xs text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:border-purple-500 transition font-mono"
                  />
                  {formattedAmountPreview() && (
                    <span className="absolute left-3 top-2.5 text-[10px] text-purple-400 font-mono">
                      {formattedAmountPreview()}
                    </span>
                  )}
                </div>
              </div>

              {/* Category Select */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--text2)]">{isEn ? 'Category' : 'دسته‌بندی'}</label>
                <Select
                  value={category}
                  onChange={setCategory}
                  className="w-full"
                  options={FINANCE_CATEGORIES[financeType].map((c) => ({
                    value: c,
                    label: c
                  }))}
                />
              </div>

              {/* Description Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--text2)]">{isEn ? 'Description (optional)' : 'توضیحات (اختیاری)'}</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={isEn ? 'e.g. Lunch...' : 'مثال: خرید ناهار...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-xs text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:border-purple-500 transition"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!amount || parseFloat(amount) <= 0}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold disabled:opacity-40 shadow-md shadow-purple-600/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Add Transaction' : 'ثبت تراکنش'}</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Visual Analytics Chart & Category Breakdown */}
      {totalExpense > 0 && (
        <div className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text)]">
              <PieChart className="w-4 h-4 text-purple-400" />
              <span>{isEn ? "Monthly Expenses Category Breakdown" : "تحلیل هزینه‌های این ماه به تفکیک دسته‌بندی"}</span>
            </div>
            <span className="text-[11px] text-[var(--text3)] font-mono">
              {isEn ? 'Total:' : 'کل هزینه:'} {isMasked ? '****' : `${totalExpense.toLocaleString(isEn ? 'en-US' : 'fa-IR')} ${isEn ? 'Toman' : 'تومان'}`}
            </span>
          </div>

          {/* Stacked Progress Bar */}
          <div className="h-3.5 w-full bg-[var(--input-bg)] rounded-full overflow-hidden flex dir-ltr p-0.5 border border-[var(--input-border)]">
            {sortedCategories.map(([catName, catAmt]) => {
              const pct = (catAmt / totalExpense) * 100;
              const catTheme = CATEGORY_COLORS[catName] || CATEGORY_COLORS['متفرقه'];
              return (
                <div
                  key={catName}
                  style={{ width: `${pct}%` }}
                  className={`${catTheme.bar} h-full transition-all first:rounded-l-full last:rounded-r-full hover:opacity-90`}
                  title={`${catName}: ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>

          {/* Category Chips Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {sortedCategories.map(([catName, catAmt]) => {
              const pct = Math.round((catAmt / totalExpense) * 100);
              const catTheme = CATEGORY_COLORS[catName] || CATEGORY_COLORS['متفرقه'];
              const icon = CATEGORY_ICONS[catName] || <Tag className="w-3.5 h-3.5" />;

              return (
                <div
                  key={catName}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${catTheme.border} ${catTheme.bg} transition-all`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className={catTheme.text}>{icon}</span>
                    <span className="text-xs font-semibold text-[var(--text)] truncate">{catName}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 font-mono">
                    <span className="text-xs font-bold text-[var(--text)]">{pct}%</span>
                    <span className="text-[10px] text-[var(--text3)]">
                      {isMasked ? '****' : catAmt.toLocaleString(isEn ? 'en-US' : 'fa-IR')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transactions History Section */}
      <div className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] shadow-xs space-y-4">
        {/* List Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <span>{isEn ? 'Transactions List' : 'لیست تراکنش‌ها'}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text2)]">
                {filteredTransactions.length}
              </span>
            </h3>
          </div>

          {/* Controls: Search, Type Tabs, Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-[var(--text3)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? 'Search transactions...' : 'جستجو در تراکنش‌ها...'}
                className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-xs text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:border-purple-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2.5 text-[var(--text3)] hover:text-[var(--text)]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Type Filter Tabs */}
            <div className="flex items-center p-0.5 bg-[var(--input-bg)] rounded-xl border border-[var(--input-border)]">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-purple-600 text-white shadow-xs font-bold'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                {isEn ? 'All' : 'همه'}
              </button>
              <button
                onClick={() => setFilterType('expense')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  filterType === 'expense'
                    ? 'bg-rose-500 text-white shadow-xs font-bold'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                {isEn ? 'Expenses' : 'هزینه‌ها'}
              </button>
              <button
                onClick={() => setFilterType('income')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  filterType === 'income'
                    ? 'bg-emerald-500 text-white shadow-xs font-bold'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                {isEn ? 'Incomes' : 'درآمدها'}
              </button>
            </div>

            {/* Category Filter Dropdown */}
            <Select
              value={selectedCategoryFilter}
              onChange={setSelectedCategoryFilter}
              size="sm"
              className="w-36 sm:w-44 shrink-0"
              aria-label={isEn ? 'Filter by category' : 'فیلتر دسته‌بندی'}
              options={[
                { value: 'all', label: isEn ? 'All Categories' : 'همه دسته‌ها' },
                ...FINANCE_CATEGORIES.expense.map(c => ({
                  value: c,
                  label: isEn ? `Expense: ${c}` : `هزینه: ${c}`
                })),
                ...FINANCE_CATEGORIES.income.map(c => ({
                  value: c,
                  label: isEn ? `Income: ${c}` : `درآمد: ${c}`
                }))
              ]}
            />
          </div>
        </div>

        {/* Transactions Items */}
        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text3)] flex items-center justify-center">
                <Filter className="w-6 h-6" />
              </div>
              <p className="text-xs text-[var(--text2)] font-medium">
                {isEn ? 'No transactions found for this month or selected filters.' : 'تراکنشی برای این ماه یا فیلترهای انتخابی یافت نشد.'}
              </p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isExpense = tx.type === 'expense';
              const catTheme = CATEGORY_COLORS[tx.category] || CATEGORY_COLORS['متفرقه'];
              const icon = CATEGORY_ICONS[tx.category] || <Tag className="w-4 h-4" />;

              return (
                <motion.div
                  layout
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--input-bg)]/60 hover:bg-[var(--sidebar-hover)] border border-[var(--border)] transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Category Icon Badge */}
                    <div className={`w-9 h-9 rounded-xl ${catTheme.bg} ${catTheme.text} border ${catTheme.border} flex items-center justify-center shrink-0`}>
                      {icon}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text)] truncate">
                          {tx.category}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isExpense ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {isExpense ? (isEn ? 'Expense' : 'هزینه') : (isEn ? 'Income' : 'درآمد')}
                        </span>
                      </div>
                      {tx.desc && (
                        <p className="text-[11px] text-[var(--text3)] truncate mt-0.5">
                          {tx.desc}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Amount & Delete */}
                  <div className="flex items-center gap-4 shrink-0">
                    <span className={`font-mono text-xs font-extrabold dir-ltr ${
                      isExpense ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {isMasked ? '****' : `${isExpense ? '-' : '+'}${tx.amount.toLocaleString(isEn ? 'en-US' : 'fa-IR')} ${isEn ? 'Toman' : 'تومان'}`}
                    </span>

                    <button
                      onClick={() => onDeleteTransaction(tx.id)}
                      className="p-1.5 rounded-lg text-[var(--text3)] hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer opacity-80 group-hover:opacity-100"
                      title={isEn ? 'Delete Transaction' : 'حذف تراکنش'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}

