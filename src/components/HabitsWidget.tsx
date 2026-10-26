/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Flame,
  CheckCircle2,
  Circle,
  ArrowUpRight,
  Plus
} from 'lucide-react';
import { AppSettings } from '../types';
import { useHabits } from '../hooks/useHabits';
import HabitStreakGrid from './HabitStreakGrid';

interface HabitsWidgetProps {
  onNavigateToHabits: () => void;
  settings?: AppSettings;
}

export default function HabitsWidget({ onNavigateToHabits, settings }: HabitsWidgetProps) {
  const isEn = settings?.language === 'en';
  const {
    habits,
    toggleToday,
    calculateStreak,
    isCompletedToday
  } = useHabits();

  const activeHabits = habits.slice(0, 4); // Display top 4 habits in widget

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-4 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--border)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[var(--text)] flex items-center gap-2">
              {isEn ? 'Daily Habits & Streaks' : 'ردیاب عادت‌ها و روزهای تداوم'}
            </h3>
            <p className="text-[11px] text-[var(--text3)]">
              {isEn ? 'Track your daily habits and consistency' : 'ثبت منظم انجام یا پرهیز از عادت‌ها'}
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToHabits}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text2)] hover:text-[var(--text)] transition-all cursor-pointer group active:scale-95"
        >
          <span>{isEn ? 'Manage Habits' : 'مدیریت عادت‌ها'}</span>
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>

      {/* Habits List or Empty State */}
      {habits.length === 0 ? (
        <div className="p-6 text-center rounded-2xl bg-[var(--input-bg)]/60 border border-[var(--border)] space-y-2.5 flex-1 flex flex-col justify-center items-center">
          <p className="text-xs text-[var(--text2)]">
            {isEn ? 'No habits added yet. Start building powerful routines today!' : 'هنوز عادتی تعریف نکرده‌اید. با ایجاد اولین عادت مسیر پیشرفت را شروع کنید!'}
          </p>
          <button
            onClick={onNavigateToHabits}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isEn ? 'Add First Habit' : 'افزودن اولین عادت'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          {activeHabits.map((habit) => {
            const streak = calculateStreak(habit);
            const isDoneToday = isCompletedToday(habit);

            return (
              <div
                key={habit.id}
                className={`p-3.5 rounded-2xl bg-[var(--input-bg)]/70 border ${
                  habit.type === 'quit'
                    ? isDoneToday
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : 'border-rose-500/20'
                    : isDoneToday
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-[var(--border)]'
                } flex flex-col justify-between space-y-3 transition-all hover:border-slate-400/30`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold border ${
                        habit.type === 'quit'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {habit.type === 'quit' ? (isEn ? 'Quit Habit' : 'ترک عادت') : (isEn ? 'Do Habit' : 'انجام عادت')}
                    </span>

                    <div className="flex items-center gap-1 text-xs font-black text-[var(--text)]">
                      <Flame className={`w-3.5 h-3.5 ${habit.type === 'quit' ? 'text-rose-400' : 'text-emerald-400'}`} />
                      <span>{streak} {isEn ? 'd' : 'روز'}</span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-[var(--text)] line-clamp-1">
                    {habit.title}
                  </h4>

                  {/* Compact 7-day Habit Streak Grid */}
                  <HabitStreakGrid
                    habit={habit}
                    range="week"
                    compact={true}
                  />
                </div>

                <div>
                  {habit.type === 'daily' ? (
                    <button
                      onClick={() => toggleToday(habit.id)}
                      className={`w-full py-1.5 px-2.5 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                        isDoneToday
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] shadow-xs'
                      }`}
                    >
                      {isDoneToday ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Done Today ✓' : 'امروز انجام شد ✓'}</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Mark Done' : 'امروز انجام دادم'}</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleToday(habit.id)}
                      className={`w-full py-1.5 px-2.5 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                        isDoneToday
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-rose-500 text-white hover:bg-rose-600 shadow-xs'
                      }`}
                    >
                      {isDoneToday ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Avoided ✓' : 'امروز پرهیز شد ✓'}</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Avoided Today' : 'امروز انجام ندادم'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
