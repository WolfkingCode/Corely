/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  CheckCircle2,
  Check,
  Trash2,
  Edit2,
  Award,
  Target,
  ShieldCheck,
  TrendingUp,
  Calendar,
  X,
  Sparkles
} from 'lucide-react';
import { Habit, AppSettings } from '../types';
import { useHabits } from '../hooks/useHabits';
import HabitStreakGrid from './HabitStreakGrid';

interface HabitsPanelProps {
  settings?: AppSettings;
}

export default function HabitsPanel({ settings }: HabitsPanelProps) {
  const isEn = settings?.language === 'en';

  const {
    habits,
    addHabit,
    editHabit,
    deleteHabit,
    toggleToday,
    calculateStreak,
    isCompletedToday
  } = useHabits();

  // Range view mapping for each habit (defaults to 'week')
  const [habitRanges, setHabitRanges] = useState<Record<string, 'week' | 'month'>>({});

  const toggleHabitRange = (habitId: string, range: 'week' | 'month') => {
    setHabitRanges((prev) => ({ ...prev, [habitId]: range }));
  };

  // Form state for creating a new habit (collapsible)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'daily' | 'quit'>('daily');
  const [newColor, setNewColor] = useState<string>('emerald');

  // Editing state
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<'daily' | 'quit'>('daily');
  const [editColor, setEditColor] = useState<string>('emerald');

  // Delete confirmation modal state
  const [deleteModalHabit, setDeleteModalHabit] = useState<Habit | null>(null);

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'quit'>('all');

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addHabit(newTitle, newType, newColor);
    setNewTitle('');
    setIsAddOpen(false);
  };

  const handleStartEdit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setEditTitle(habit.title);
    setEditType(habit.type);
    setEditColor(habit.color || (habit.type === 'quit' ? 'rose' : 'emerald'));
  };

  const handleSaveEdit = (habitId: string) => {
    if (!editTitle.trim()) return;
    editHabit(habitId, {
      title: editTitle.trim(),
      type: editType,
      color: editColor
    });
    setEditingHabitId(null);
  };

  const handleConfirmDelete = () => {
    if (deleteModalHabit) {
      deleteHabit(deleteModalHabit.id);
      setDeleteModalHabit(null);
    }
  };

  const filteredHabits = habits.filter((h) => {
    if (filterType === 'all') return true;
    return h.type === filterType;
  });

  // Calculate overall summary stats
  const totalHabits = habits.length;
  const dailyCount = habits.filter((h) => h.type === 'daily').length;
  const quitCount = habits.filter((h) => h.type === 'quit').length;
  const completedTodayCount = habits.filter((h) => isCompletedToday(h)).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* 1. Header with Title & Action Button */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1 py-2">
        <h2 className="text-xl font-black text-[var(--text)]">
          {isEn ? 'Habits & Streaks' : 'ردیاب عادت‌ها و تداوم روزانه'}
        </h2>

        {/* "+ New Habit" Button */}
        <button
          type="button"
          onClick={() => setIsAddOpen((prev) => !prev)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm press-feedback ${
            isAddOpen
              ? 'bg-[var(--sidebar-active)] text-[var(--text)] border border-[var(--border)]'
              : 'bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white shadow-md'
          }`}
        >
          {isAddOpen ? (
            <>
              <X className="w-4 h-4" />
              <span>{isEn ? 'Close Form' : 'بستن فرم'}</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>{isEn ? '+ New Habit' : '+ عادت جدید'}</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Collapsible Form for Creating New Habit */}
      <AnimatePresence>
        {isAddOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--accent)]/40 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[var(--accent-glass)] text-[var(--accent-strong)] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--text)]">
                      {isEn ? 'Create New Habit' : 'ایجاد عادت جدید'}
                    </h3>
                    <p className="text-[11px] text-[var(--text3)]">
                      {isEn
                        ? 'Track habits you want to build or negative habits you want to quit'
                        : 'پایش عادت‌های مثبتی که می‌خواهید انجام دهید یا عادت‌هایی که قصد ترک آن‌ها را دارید'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-[var(--sidebar-hover)] text-[var(--text3)] hover:text-[var(--text)] transition-colors cursor-pointer press-feedback"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateHabit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Title input */}
                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-[var(--text2)] mb-1.5">
                      {isEn ? 'Habit Title / Goal' : 'عنوان عادت یا هدف:'}
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder={
                        newType === 'daily'
                          ? (isEn ? 'e.g. 30 mins workout, read 10 pages...' : 'مثلاً ۳۰ دقیقه ورزش، خواندن ۱۰ صفحه کتاب...')
                          : (isEn ? 'e.g. Quit smoking, avoid junk food...' : 'مثلاً ترک سیگار، عدم مصرف شکر...')
                      }
                      className="w-full px-4 py-2.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text3)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                    />
                  </div>

                  {/* iOS-Style Type selector */}
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-[var(--text2)] mb-1.5">
                      {isEn ? 'Habit Type' : 'نوع عادت:'}
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--input-bg)] border border-[var(--border)] relative">
                      <button
                        type="button"
                        onClick={() => {
                          setNewType('daily');
                          setNewColor('emerald');
                        }}
                        className={`relative py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 press-feedback ${
                          newType === 'daily'
                            ? 'text-emerald-500 font-extrabold'
                            : 'text-[var(--text3)] hover:text-[var(--text)]'
                        }`}
                      >
                        {newType === 'daily' && (
                          <motion.div
                            layoutId="new-habit-type-pill"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            className="absolute inset-0 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-black/5 dark:border-white/10 z-0"
                          />
                        )}
                        <CheckCircle2 className="w-3.5 h-3.5 relative z-10" />
                        <span className="relative z-10">{isEn ? 'Do Habit' : 'انجام عادت'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewType('quit');
                          setNewColor('rose');
                        }}
                        className={`relative py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 press-feedback ${
                          newType === 'quit'
                            ? 'text-rose-500 font-extrabold'
                            : 'text-[var(--text3)] hover:text-[var(--text)]'
                        }`}
                      >
                        {newType === 'quit' && (
                          <motion.div
                            layoutId="new-habit-type-pill"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            className="absolute inset-0 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-black/5 dark:border-white/10 z-0"
                          />
                        )}
                        <ShieldCheck className="w-3.5 h-3.5 relative z-10" />
                        <span className="relative z-10">{isEn ? 'Quit Habit' : 'ترک عادت'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="md:col-span-3 flex items-end gap-2">
                    <button
                      type="submit"
                      disabled={!newTitle.trim()}
                      className="flex-1 py-2.5 px-4 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 press-feedback"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isEn ? 'Add Habit' : 'افزودن عادت'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddOpen(false)}
                      className="py-2.5 px-3 rounded-2xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text3)] hover:text-[var(--text)] text-xs font-bold border border-[var(--border)] transition-colors cursor-pointer press-feedback"
                    >
                      {isEn ? 'Cancel' : 'انصراف'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Filter Tabs & Habits List (iOS-STYLE SEGMENTED CONTROL) */}
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* iOS Segmented Capsule */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-[var(--input-bg)] border border-[var(--input-border)] shadow-xs relative">
            <button
              onClick={() => setFilterType('all')}
              className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer press-feedback ${
                filterType === 'all'
                  ? 'text-[var(--text)] font-extrabold'
                  : 'text-[var(--text3)] hover:text-[var(--text2)]'
              }`}
            >
              {filterType === 'all' && (
                <motion.div
                  layoutId="active-habit-filter-pill"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-black/5 dark:border-white/10 z-0"
                />
              )}
              <span className="relative z-10">{isEn ? 'All' : 'همه'} ({totalHabits})</span>
            </button>

            <button
              onClick={() => setFilterType('daily')}
              className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer press-feedback ${
                filterType === 'daily'
                  ? 'text-emerald-500 dark:text-emerald-400 font-extrabold'
                  : 'text-[var(--text3)] hover:text-[var(--text2)]'
              }`}
            >
              {filterType === 'daily' && (
                <motion.div
                  layoutId="active-habit-filter-pill"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-emerald-500/20 z-0"
                />
              )}
              <span className="relative z-10">{isEn ? 'Do Habit' : 'انجام عادت'} ({dailyCount})</span>
            </button>

            <button
              onClick={() => setFilterType('quit')}
              className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer press-feedback ${
                filterType === 'quit'
                  ? 'text-rose-500 dark:text-rose-400 font-extrabold'
                  : 'text-[var(--text3)] hover:text-[var(--text2)]'
              }`}
            >
              {filterType === 'quit' && (
                <motion.div
                  layoutId="active-habit-filter-pill"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-rose-500/20 z-0"
                />
              )}
              <span className="relative z-10">{isEn ? 'Quit Habit' : 'ترک عادت'} ({quitCount})</span>
            </button>
          </div>

          <span className="text-xs text-[var(--text3)] font-medium">
            {isEn ? `Showing ${filteredHabits.length} habits` : `نمایش ${filteredHabits.length} عادت`}
          </span>
        </div>

        {/* Empty state */}
        {filteredHabits.length === 0 && (
          <div className="p-10 text-center rounded-3xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[var(--text)]">
              {isEn ? 'No habits in this category yet' : 'هنوز عادتی در این بخش ثبت نشده است'}
            </h4>
            <p className="text-xs text-[var(--text3)] max-w-sm mx-auto">
              {isEn
                ? 'Create positive daily habits to build or negative habits to quit.'
                : 'با استفاده از دکمه «+ عادت جدید» اولین عادت خود را تعریف و پیگیری کنید.'}
            </p>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? '+ New Habit' : '+ عادت جدید'}</span>
            </button>
          </div>
        )}

        {/* Habits Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredHabits.map((habit) => {
            const streak = calculateStreak(habit);
            const isDoneToday = isCompletedToday(habit);
            const isEditing = editingHabitId === habit.id;

            const dotColor = habit.type === 'quit'
              ? 'bg-rose-500'
              : (habit.color === 'rose'
                  ? 'bg-rose-500'
                  : habit.color === 'amber'
                  ? 'bg-amber-500'
                  : habit.color === 'blue'
                  ? 'bg-blue-500'
                  : habit.color === 'purple'
                  ? 'bg-purple-500'
                  : 'bg-emerald-500');

            return (
              <motion.div
                key={habit.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`p-4 rounded-2xl bg-[var(--card-bg)] border ${
                  habit.type === 'quit'
                    ? isDoneToday
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : 'border-rose-500/20 hover:border-rose-500/40'
                    : isDoneToday
                    ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                    : 'border-[var(--card-border)] hover:border-blue-500/30'
                } shadow-sm hover:shadow-md transition-all group relative flex flex-col justify-between`}
              >
                {/* Edit & Delete Actions (hover on card, always visible on touch/mobile) */}
                <div className="absolute top-3 end-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity z-10">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(habit)}
                    className="p-1 rounded-lg hover:bg-[var(--sidebar-hover)] text-[var(--text3)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    title={isEn ? 'Edit habit' : 'ویرایش'}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteModalHabit(habit)}
                    className="p-1 rounded-lg hover:bg-red-500/10 text-[var(--text3)] hover:text-red-400 transition-colors cursor-pointer"
                    title={isEn ? 'Delete habit' : 'حذف'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Edit inline view OR Normal view */}
                {isEditing ? (
                  <div className="space-y-3 py-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                    />

                    {/* Edit Type */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setEditType('daily')}
                        className={`py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          editType === 'daily'
                            ? 'bg-emerald-500 text-white'
                            : 'text-[var(--text3)]'
                        }`}
                      >
                        {isEn ? 'Do Habit' : 'انجام عادت'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditType('quit')}
                        className={`py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          editType === 'quit'
                            ? 'bg-rose-500 text-white'
                            : 'text-[var(--text3)]'
                        }`}
                      >
                        {isEn ? 'Quit Habit' : 'ترک عادت'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(habit.id)}
                        className="flex-1 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold cursor-pointer"
                      >
                        {isEn ? 'Save' : 'ذخیره'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingHabitId(null)}
                        className="py-1.5 px-3 rounded-xl bg-[var(--input-bg)] text-[var(--text3)] text-xs font-medium cursor-pointer"
                      >
                        {isEn ? 'Cancel' : 'انصراف'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Main Row */}
                    <div className="flex items-center gap-3">
                      {/* Start: small colored circle */}
                      <div className={`w-3 h-3 rounded-full shrink-0 ${dotColor}`} />

                      {/* Middle: Title, type, streak */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-[var(--text)] truncate pe-14">
                          {habit.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text3)] flex-wrap">
                          <span>
                            {habit.type === 'quit' ? (isEn ? 'Quit Habit' : 'ترک عادت') : (isEn ? 'Do Habit' : 'انجام عادت')}
                          </span>
                          <span>•</span>
                          <span>
                            🔥 {streak} {isEn ? 'days' : 'روز'}
                          </span>
                          {streak >= 7 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 font-bold px-1.5 py-0.2 rounded-md bg-amber-500/10 border border-amber-500/20">
                              <Award className="w-2.5 h-2.5" />
                              <span>{streak >= 30 ? (isEn ? 'Master' : 'استاد') : (isEn ? 'Pro' : 'عالی')}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* End: Today's check circular button */}
                      <button
                        type="button"
                        onClick={() => toggleToday(habit.id)}
                        title={
                          habit.type === 'daily'
                            ? (isDoneToday ? (isEn ? 'Done Today ✓' : 'امروز انجام شد ✓') : (isEn ? 'Mark Done Today' : 'امروز انجام دادم'))
                            : (isDoneToday ? (isEn ? 'Avoided Today ✓' : 'امروز پرهیز شد ✓') : (isEn ? 'Avoided Today' : 'امروز انجام ندادم'))
                        }
                        aria-label={
                          habit.type === 'daily'
                            ? (isDoneToday ? (isEn ? 'Done Today ✓' : 'امروز انجام شد ✓') : (isEn ? 'Mark Done Today' : 'امروز انجام دادم'))
                            : (isDoneToday ? (isEn ? 'Avoided Today ✓' : 'امروز پرهیز شد ✓') : (isEn ? 'Avoided Today' : 'امروز انجام ندادم'))
                        }
                        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs press-feedback ${
                          isDoneToday
                            ? (habit.type === 'quit' ? 'bg-rose-500 text-white shadow-rose-500/30' : 'bg-emerald-500 text-white shadow-emerald-500/30')
                            : 'border-2 border-[var(--border)] hover:border-[var(--accent)] text-transparent hover:text-[var(--text3)]'
                        }`}
                      >
                        {isDoneToday && <Check className="w-5 h-5 stroke-[2.5]" />}
                      </button>
                    </div>

                    {/* Visual Habit Streak Grid & Range Switcher */}
                    <div className="mt-3 space-y-1.5 pt-2 border-t border-[var(--border)]/60">
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-[10px] font-semibold text-[var(--text3)] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[var(--accent)]" />
                          <span>{isEn ? 'History Calendar' : 'تقویم سابقه'}</span>
                        </span>

                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] relative">
                          <button
                            type="button"
                            onClick={() => toggleHabitRange(habit.id, 'week')}
                            className={`relative px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-colors cursor-pointer press-feedback ${
                              (habitRanges[habit.id] || 'week') === 'week'
                                ? 'text-[var(--text)] font-extrabold'
                                : 'text-[var(--text3)] hover:text-[var(--text)]'
                            }`}
                          >
                            {(habitRanges[habit.id] || 'week') === 'week' && (
                              <motion.div
                                layoutId={`range-pill-${habit.id}`}
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                className="absolute inset-0 rounded-md bg-white dark:bg-slate-800 shadow-xs border border-black/5 dark:border-white/10 z-0"
                              />
                            )}
                            <span className="relative z-10">{isEn ? 'Week' : 'هفته'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHabitRange(habit.id, 'month')}
                            className={`relative px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-colors cursor-pointer press-feedback ${
                              habitRanges[habit.id] === 'month'
                                ? 'text-[var(--text)] font-extrabold'
                                : 'text-[var(--text3)] hover:text-[var(--text)]'
                            }`}
                          >
                            {habitRanges[habit.id] === 'month' && (
                              <motion.div
                                layoutId={`range-pill-${habit.id}`}
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                className="absolute inset-0 rounded-md bg-white dark:bg-slate-800 shadow-xs border border-black/5 dark:border-white/10 z-0"
                              />
                            )}
                            <span className="relative z-10">{isEn ? 'Month' : 'ماه'}</span>
                          </button>
                        </div>
                      </div>

                      <HabitStreakGrid
                        habit={habit}
                        range={habitRanges[habit.id] || 'week'}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 4. Statistics & Overview (Chips at the bottom) */}
      <div className="pt-4 border-t border-[var(--border)] space-y-3">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-xs font-extrabold text-[var(--text2)] uppercase tracking-wider">
            {isEn ? 'Consistency & Overview Stats' : 'آمار و وضعیت کلی پایبندی'}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[var(--text3)]">{isEn ? 'Total Habits' : 'کل عادت‌ها'}:</span>
            <span className="font-bold text-[var(--text)]">{totalHabits}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[var(--text3)]">{isEn ? "Today's Completed" : 'ثبت‌شده‌های امروز'}:</span>
            <span className="font-bold text-emerald-400">
              {completedTodayCount} <span className="text-[var(--text3)] font-normal">/ {totalHabits}</span>
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[var(--text3)]">{isEn ? 'Quit Habits' : 'عادت‌های ترک'}:</span>
            <span className="font-bold text-rose-400">{quitCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[var(--text3)]">{isEn ? 'Consistency Rate' : 'نرخ پایبندی امروز'}:</span>
            <span className="font-bold text-purple-400">
              {totalHabits > 0 ? `${Math.round((completedTodayCount / totalHabits) * 100)}%` : '۱۰۰٪'}
            </span>
          </div>
        </div>
      </div>

      {/* Modal: Delete Confirmation (Windows 11 Acrylic / Mica Surface) */}
      <AnimatePresence>
        {deleteModalHabit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm p-6 rounded-3xl modal-acrylic space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-[var(--text)]">
                  {isEn ? 'Delete Habit?' : 'حذف این عادت؟'}
                </h3>
                <p className="text-xs text-[var(--text3)] mt-1.5 leading-relaxed">
                  {isEn
                    ? `Are you sure you want to delete "${deleteModalHabit.title}"? All progress history will be removed.`
                    : `آیا از حذف عادت «${deleteModalHabit.title}» مطمئن هستید؟ تمامی سوابق این عادت پاک خواهند شد.`}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalHabit(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] cursor-pointer press-feedback"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-500 text-white shadow-md hover:bg-red-600 cursor-pointer press-feedback"
                >
                  {isEn ? 'Delete' : 'حذف کامل'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
