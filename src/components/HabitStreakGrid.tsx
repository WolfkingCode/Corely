/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Habit } from '../types';
import {
  getShamsiParts,
  getDaysInShamsiMonth,
  getLocalDateKey,
  SHAMSI_MONTHS
} from '../lib/utils';

interface HabitStreakGridProps {
  habit: Habit;
  completedDates?: string[];
  range: 'week' | 'month';
  compact?: boolean;
}

// Iranian week day abbreviations in LTR order (Saturday to Friday)
const IRAN_WEEK_DAYS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export default function HabitStreakGrid({
  habit,
  completedDates,
  range,
  compact = false
}: HabitStreakGridProps) {
  // Use passed completedDates, or deduce from habit type
  const activeDates =
    completedDates ||
    (habit.type === 'quit' ? habit.avoidedDates : habit.completedDates) ||
    [];
  const dateSet = new Set(activeDates);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentShamsi = getShamsiParts(today);

  // -------------------------------------------------------------
  // WEEK VIEW: Current week from Saturday (شنبه) to Friday (جمعه)
  // -------------------------------------------------------------
  if (range === 'week') {
    const todayDow = today.getDay(); // 0 is Sunday, 6 is Saturday
    const satOffset = (todayDow + 1) % 7; // Sat (6) -> 0, Sun (0) -> 1, ...
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - satOffset);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dateKey = getLocalDateKey(d);
      const shamsi = getShamsiParts(d);
      const isToday = d.getTime() === today.getTime();
      const isFuture = d.getTime() > today.getTime();
      const isSuccess = !isFuture && dateSet.has(dateKey);
      const isPastMissed = !isFuture && !isSuccess;

      return {
        dateKey,
        dayName: IRAN_WEEK_DAYS_FA[i],
        dayNumber: shamsi.jd,
        monthName: SHAMSI_MONTHS[shamsi.jm - 1],
        isToday,
        isFuture,
        isSuccess,
        isPastMissed
      };
    });

    return (
      <div
        dir="ltr"
        className={`p-2 rounded-2xl bg-[var(--input-bg)]/80 border border-[var(--border)] shadow-xs ${
          compact ? 'py-1.5 px-2' : ''
        }`}
      >
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekDays.map((day) => {
            const tooltip = day.isFuture
              ? `${day.dayNumber} ${day.monthName} (آینده)`
              : day.isToday
              ? `${day.dayNumber} ${day.monthName} (امروز) - ${day.isSuccess ? 'موفق ✓' : 'انجام نشده'}`
              : `${day.dayNumber} ${day.monthName} - ${day.isSuccess ? 'موفق ✓' : 'انجام نشده'}`;

            return (
              <div
                key={day.dateKey}
                className="flex flex-col items-center gap-1 group relative"
              >
                {/* Visual block */}
                <div
                  title={tooltip}
                  className={`w-full transition-all flex items-center justify-center font-extrabold ${
                    compact ? 'h-4 rounded-md text-[9px]' : 'h-6 sm:h-7 rounded-xl text-[10px]'
                  } ${
                    day.isFuture
                      ? 'bg-[var(--card-bg)]/60 border border-[var(--border)]/40 text-[var(--text3)]/30 cursor-default opacity-40'
                      : day.isSuccess
                      ? 'bg-[var(--accent)] text-white shadow-xs scale-100 hover:scale-105 cursor-pointer'
                      : 'bg-rose-500/20 dark:bg-rose-500/25 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 cursor-pointer'
                  }`}
                >
                  {day.isToday && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        day.isSuccess ? 'bg-white' : 'bg-rose-500 animate-pulse'
                      }`}
                    />
                  )}
                </div>

                {/* Day label if not compact */}
                {!compact && (
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[8.5px] text-[var(--text3)] font-medium">
                      {day.dayName}
                    </span>
                    <span
                      className={`text-[9px] font-bold ${
                        day.isToday
                          ? 'text-[var(--accent-strong)] font-black'
                          : day.isFuture
                          ? 'text-[var(--text3)]/40'
                          : 'text-[var(--text2)]'
                      }`}
                    >
                      {day.dayNumber}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MONTH VIEW: Real Current Shamsi Month (Day 1 to Last Day)
  // -------------------------------------------------------------
  const daysInMonth = getDaysInShamsiMonth(currentShamsi.jy, currentShamsi.jm);
  const currentMonthName = SHAMSI_MONTHS[currentShamsi.jm - 1];

  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNumber = i + 1;
    // Calculate Gregorian date corresponding to dayNumber of current Shamsi month
    const d = new Date(today);
    d.setDate(today.getDate() + (dayNumber - currentShamsi.jd));
    const dateKey = getLocalDateKey(d);

    const isToday = dayNumber === currentShamsi.jd;
    const isFuture = dayNumber > currentShamsi.jd;
    const isSuccess = !isFuture && dateSet.has(dateKey);
    const isPastMissed = !isFuture && !isSuccess;

    return {
      dateKey,
      dayNumber,
      isToday,
      isFuture,
      isSuccess,
      isPastMissed
    };
  });

  return (
    <div
      dir="ltr"
      className="p-2.5 rounded-2xl bg-[var(--input-bg)]/80 border border-[var(--border)] shadow-xs space-y-2"
    >
      <div className="flex items-center justify-between px-1 text-[10px] text-[var(--text3)] font-bold">
        <span>
          {currentMonthName} {currentShamsi.jy} ({daysInMonth} روز)
        </span>
        <span className="text-[9.5px] font-normal">
          امروز: {currentShamsi.jd} {currentMonthName}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {monthDays.map((day) => {
          const tooltip = day.isFuture
            ? `${day.dayNumber} ${currentMonthName} (آینده)`
            : day.isToday
            ? `${day.dayNumber} ${currentMonthName} (امروز) - ${day.isSuccess ? 'موفق ✓' : 'انجام نشده'}`
            : `${day.dayNumber} ${currentMonthName} - ${day.isSuccess ? 'موفق ✓' : 'انجام نشده'}`;

          return (
            <div
              key={day.dateKey}
              title={tooltip}
              className={`h-6 sm:h-7 rounded-xl transition-all flex items-center justify-center text-[10.5px] font-extrabold relative ${
                day.isFuture
                  ? 'bg-[var(--card-bg)]/50 border border-[var(--border)]/30 text-[var(--text3)]/30 cursor-default opacity-40'
                  : day.isSuccess
                  ? 'bg-[var(--accent)] text-white shadow-xs hover:scale-105 cursor-pointer'
                  : 'bg-rose-500/20 dark:bg-rose-500/25 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 cursor-pointer'
              }`}
            >
              <span>{day.dayNumber}</span>
              {day.isToday && (
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--card-bg)] ${
                    day.isSuccess ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
