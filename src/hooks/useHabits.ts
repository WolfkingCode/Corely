/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Habit } from '../types';

const STORAGE_KEY = 'v3_habits';

// Helper to get formatted ISO date "YYYY-MM-DD"
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to calculate difference in calendar days between two "YYYY-MM-DD" strings
export function getDaysDifference(fromStr: string, toStr: string): number {
  try {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    const diffTime = to.getTime() - from.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

// Initial sample habits
const INITIAL_HABITS: Habit[] = [];

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Habit[] = JSON.parse(saved);
        // Migration logic for old data format
        return parsed.map((h) => {
          if (h.type === 'quit' && !Array.isArray(h.avoidedDates)) {
            return {
              ...h,
              avoidedDates: []
            };
          }
          if (h.type === 'daily' && !Array.isArray(h.completedDates)) {
            return {
              ...h,
              completedDates: []
            };
          }
          return h;
        });
      }
    } catch (e) {
      console.warn('Failed to load habits from localStorage:', e);
    }
    return INITIAL_HABITS;
  });

  // Save to localStorage whenever habits change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch (e) {
      console.warn('Failed to save habits to localStorage:', e);
    }
  }, [habits]);

  // Helper to retrieve success dates array based on habit type
  const getSuccessDates = useCallback((habit: Habit): string[] => {
    return habit.type === 'quit' ? (habit.avoidedDates || []) : (habit.completedDates || []);
  }, []);

  // Check if habit is marked successful today
  const isCompletedToday = useCallback((habit: Habit): boolean => {
    const today = getTodayDateString();
    const dates = getSuccessDates(habit);
    return dates.includes(today);
  }, [getSuccessDates]);

  // Calculate consecutive days streak for both 'daily' and 'quit'
  const calculateStreak = useCallback((habit: Habit): number => {
    const dates = getSuccessDates(habit);
    const dateSet = new Set(dates);
    if (dateSet.size === 0) return 0;

    let streak = 0;
    const current = new Date();
    current.setHours(0, 0, 0, 0);

    const todayStr = getTodayDateString();
    const checkDate = new Date(current);

    // If today is not checked yet, start from yesterday so streak doesn't break prematurely
    if (!dateSet.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const y = checkDate.getFullYear();
      const m = String(checkDate.getMonth() + 1).padStart(2, '0');
      const d = String(checkDate.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;

      if (dateSet.has(dateKey)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }, [getSuccessDates]);

  // Count successful days in the last 7 days (including today)
  const getWeeklyCount = useCallback((habit: Habit): number => {
    const dateSet = new Set(getSuccessDates(habit));
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;

      if (dateSet.has(dateKey)) {
        count++;
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    return count;
  }, [getSuccessDates]);

  // Count successful days in the last 30 days (including today)
  const getMonthlyCount = useCallback((habit: Habit): number => {
    const dateSet = new Set(getSuccessDates(habit));
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;

      if (dateSet.has(dateKey)) {
        count++;
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    return count;
  }, [getSuccessDates]);

  // Add new habit
  const addHabit = useCallback((title: string, type: 'quit' | 'daily', color?: string) => {
    if (!title.trim()) return;
    const today = getTodayDateString();
    const newHabit: Habit = {
      id: `habit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      type,
      createdAt: today,
      completedDates: type === 'daily' ? [] : undefined,
      avoidedDates: type === 'quit' ? [] : undefined,
      color: color || (type === 'quit' ? 'rose' : 'emerald')
    };

    setHabits((prev) => [newHabit, ...prev]);
    return newHabit;
  }, []);

  // Edit existing habit
  const editHabit = useCallback((id: string, updates: Partial<Omit<Habit, 'id'>>) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    );
  }, []);

  // Delete habit
  const deleteHabit = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // Toggle today for either 'daily' (completedDates) or 'quit' (avoidedDates)
  const toggleToday = useCallback((habitId: string) => {
    const today = getTodayDateString();
    setHabits((prev) =>
      prev.map((habit) => {
        if (habit.id !== habitId) return habit;

        if (habit.type === 'quit') {
          const currentDates = habit.avoidedDates || [];
          const isDone = currentDates.includes(today);
          const updatedDates = isDone
            ? currentDates.filter((d) => d !== today)
            : [...currentDates, today];
          return {
            ...habit,
            avoidedDates: updatedDates
          };
        } else {
          const currentDates = habit.completedDates || [];
          const isDone = currentDates.includes(today);
          const updatedDates = isDone
            ? currentDates.filter((d) => d !== today)
            : [...currentDates, today];
          return {
            ...habit,
            completedDates: updatedDates
          };
        }
      })
    );
  }, []);

  return {
    habits,
    addHabit,
    editHabit,
    deleteHabit,
    toggleToday,
    calculateStreak,
    isCompletedToday,
    getWeeklyCount,
    getMonthlyCount
  };
}
