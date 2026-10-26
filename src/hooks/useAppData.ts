/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { 
  loadFromLocalStorage, 
  saveToLocalStorage, 
  getLocalDateKey, 
  getWeekKey, 
  getShamsiParts 
} from '../lib/utils';
import { 
  Idea, 
  IdeaComment, 
  TaskItem, 
  WeekExtras, 
  WeekExtra,
  Transaction, 
  LastActivity,
  SavingsGoal
} from '../types';

export const FIXED_DAILY_DEFAULT: string[] = [];

interface UseAppDataProps {
  onPlaySound?: () => void;
}

export function useAppData({ onPlaySound }: UseAppDataProps = {}) {
  // Core App States
  const [ideas, setIdeas] = useState<Idea[]>(() => loadFromLocalStorage<Idea[]>('v3_ideas', []));
  const [todos, setTodos] = useState<TaskItem[]>(() => loadFromLocalStorage<TaskItem[]>('v3_todos', []));
  const [shopping, setShopping] = useState<TaskItem[]>(() => loadFromLocalStorage<TaskItem[]>('v3_shopping', []));
  const [finance, setFinance] = useState<Transaction[]>(() => loadFromLocalStorage<Transaction[]>('v3_finance', []));
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => loadFromLocalStorage<SavingsGoal[]>('v3_savings_goals', []));
  const [note, setNote] = useState<string>(() => localStorage.getItem('v3_note') || '');
  const [fixedDaily, setFixedDaily] = useState<string[]>(() => loadFromLocalStorage<string[]>('v3_fixed', FIXED_DAILY_DEFAULT));
  
  const currentWeekKey = getWeekKey();
  const [weekExtras, setWeekExtras] = useState<WeekExtras>(() => {
    const raw = loadFromLocalStorage<WeekExtras>(`v3_week_${currentWeekKey}`, {});
    const normalized: WeekExtras = {};
    Object.keys(raw).forEach((k) => {
      normalized[k] = (raw[k] || []).map((item, idx) => ({
        id: item.id || `we-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        text: item.text,
        done: item.done
      }));
    });
    return normalized;
  });

  const [lastActivity, setLastActivity] = useState<LastActivity | null>(() => 
    loadFromLocalStorage<LastActivity | null>('v3_last_activity', null)
  );

  const noteActivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noteActivityTimerRef.current) {
        clearTimeout(noteActivityTimerRef.current);
      }
    };
  }, []);

  // Centralized helper to track last activity
  const handleTrackActivity = (type: LastActivity['type'], text: string) => {
    const act: LastActivity = { type, text, ts: Date.now() };
    setLastActivity(act);
    saveToLocalStorage('v3_last_activity', act);
  };

  // Note updates
  const handleNoteChange = (newNote: string): boolean => {
    setNote(newNote);
    let success = true;
    try {
      localStorage.setItem('v3_note', newNote);
    } catch {
      success = false;
    }
    if (noteActivityTimerRef.current) {
      clearTimeout(noteActivityTimerRef.current);
    }
    if (newNote.trim()) {
      noteActivityTimerRef.current = setTimeout(() => {
        handleTrackActivity('note', newNote.trim().slice(0, 80) + (newNote.trim().length > 80 ? '...' : ''));
      }, 800);
    }
    return success;
  };

  // Ideas updates
  const handleAddIdea = () => {
    const newIdea: Idea = {
      id: Date.now(),
      title: '',
      desc: '',
      links: [],
      images: [],
      status: 0,
      date: new Date().toLocaleDateString('fa-IR')
    };
    setIdeas((prev) => {
      const updated = [newIdea, ...prev];
      saveToLocalStorage('v3_ideas', updated);
      return updated;
    });
  };

  const handleUpdateIdea = (id: number, field: keyof Idea, value: string | number | string[] | IdeaComment[]) => {
    setIdeas((prev) => {
      const updated = prev.map((idea) => {
        if (idea.id === id) {
          const up = { ...idea, [field]: value };
          if (field === 'title' || field === 'desc') {
            const content = (up.title || up.desc || '').trim();
            if (content) {
              handleTrackActivity('idea', content.slice(0, 80) + (content.length > 80 ? '...' : ''));
            }
          }
          return up;
        }
        return idea;
      });
      saveToLocalStorage('v3_ideas', updated);
      return updated;
    });
  };

  const handleDeleteIdea = (id: number) => {
    setIdeas((prev) => {
      const updated = prev.filter((idea) => idea.id !== id);
      saveToLocalStorage('v3_ideas', updated);
      return updated;
    });
  };

  const handleAddLink = (id: number) => {
    setIdeas((prev) => {
      const updated = prev.map((idea) => {
        if (idea.id === id) {
          return { ...idea, links: [...(idea.links || []), ''] };
        }
        return idea;
      });
      saveToLocalStorage('v3_ideas', updated);
      return updated;
    });
  };

  const handleUpdateLink = (id: number, idx: number, value: string) => {
    setIdeas((prev) => {
      const updated = prev.map((idea) => {
        if (idea.id === id) {
          const l = [...(idea.links || [])];
          l[idx] = value;
          return { ...idea, links: l };
        }
        return idea;
      });
      saveToLocalStorage('v3_ideas', updated);
      return updated;
    });
  };

  const handleDeleteLink = (id: number, idx: number) => {
    setIdeas((prev) => {
      const updated = prev.map((idea) => {
        if (idea.id === id) {
          const l = [...(idea.links || [])];
          l.splice(idx, 1);
          return { ...idea, links: l };
        }
        return idea;
      });
      saveToLocalStorage('v3_ideas', updated);
      return updated;
    });
  };

  const handleAddImage = (id: number, base64Src: string) => {
    setIdeas((prev) => {
      const updated = prev.map((idea) => {
        if (idea.id === id) {
          const nowStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
          const newComment: IdeaComment = {
            id: `cm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            text: '',
            image: base64Src,
            timestamp: nowStr
          };
          return {
            ...idea,
            images: [...(idea.images || []), base64Src],
            comments: [...(idea.comments || []), newComment]
          };
        }
        return idea;
      });
      saveToLocalStorage('v3_ideas', updated);
      return updated;
    });
  };

  const handleDeleteImage = (id: number, idx: number) => {
    setIdeas((prev) => {
      const updated = prev.map((idea) => {
        if (idea.id === id) {
          const imgs = [...(idea.images || [])];
          imgs.splice(idx, 1);
          return { ...idea, images: imgs };
        }
        return idea;
      });
      saveToLocalStorage('v3_ideas', updated);
      return updated;
    });
  };

  // Week extra updates
  const handleAddExtra = (key: string, text: string) => {
    const newExtra: WeekExtra = {
      id: `we-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      done: false
    };
    const extras = {
      ...weekExtras,
      [key]: [...(weekExtras[key] || []), newExtra]
    };
    setWeekExtras(extras);
    saveToLocalStorage(`v3_week_${currentWeekKey}`, extras);
    handleTrackActivity('week', text);
  };

  const handleToggleExtra = (key: string, idx: number) => {
    if (!weekExtras[key] || !weekExtras[key][idx]) return;
    const toggledItemText = weekExtras[key][idx].text;
    const updatedDayExtras = weekExtras[key].map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    );
    const extras = {
      ...weekExtras,
      [key]: updatedDayExtras
    };
    setWeekExtras(extras);
    saveToLocalStorage(`v3_week_${currentWeekKey}`, extras);
    handleTrackActivity('week', toggledItemText);
    if (onPlaySound) onPlaySound();
  };

  const handleDeleteExtra = (key: string, idx: number) => {
    if (!weekExtras[key]) return;
    const extras = {
      ...weekExtras,
      [key]: weekExtras[key].filter((_, i) => i !== idx)
    };
    setWeekExtras(extras);
    saveToLocalStorage(`v3_week_${currentWeekKey}`, extras);
  };

  const handleReorderExtras = (key: string, newExtras: WeekExtra[]) => {
    const extras = { ...weekExtras, [key]: newExtras };
    setWeekExtras(extras);
    saveToLocalStorage(`v3_week_${currentWeekKey}`, extras);
  };

  const handleUpdateFixedDaily = (newFixed: string[]) => {
    setFixedDaily(newFixed);
    saveToLocalStorage('v3_fixed', newFixed);
  };

  // Tasks (Todos / Shopping) updates
  const handleAddTask = (
    type: 'todos' | 'shopping',
    text: string,
    priority?: 'urgent' | 'important' | 'normal',
    category?: string,
    quantity?: number,
    unit?: string
  ) => {
    const list = type === 'todos' ? todos : shopping;
    const updated = [...list, { text, done: false, priority: priority || 'normal', category, quantity, unit }];
    if (type === 'todos') {
      setTodos(updated);
      saveToLocalStorage('v3_todos', updated);
    } else {
      setShopping(updated);
      saveToLocalStorage('v3_shopping', updated);
    }
    handleTrackActivity(type === 'todos' ? 'task' : 'shopping', text);
    if (onPlaySound) onPlaySound();
  };

  const handleToggleTask = (type: 'todos' | 'shopping', idx: number) => {
    const list = type === 'todos' ? [...todos] : [...shopping];
    if (list[idx]) {
      list[idx].done = !list[idx].done;
      if (type === 'todos') {
        setTodos(list);
        saveToLocalStorage('v3_todos', list);
      } else {
        setShopping(list);
        saveToLocalStorage('v3_shopping', list);
      }
      handleTrackActivity(type === 'todos' ? 'task' : 'shopping', list[idx].text);
      if (onPlaySound) onPlaySound();
    }
  };

  const handleDeleteTask = (type: 'todos' | 'shopping', idx: number) => {
    const list = type === 'todos' ? [...todos] : [...shopping];
    list.splice(idx, 1);
    if (type === 'todos') {
      setTodos(list);
      saveToLocalStorage('v3_todos', list);
    } else {
      setShopping(list);
      saveToLocalStorage('v3_shopping', list);
    }
  };

  // Finance updates
  const handleAddTransaction = (
    type: 'expense' | 'income',
    amount: number,
    category: string,
    desc: string
  ) => {
    const now = new Date();
    const sp = getShamsiParts(now);
    const tx: Transaction = {
      id: Date.now(),
      type,
      amount,
      category,
      desc,
      dateKey: getLocalDateKey(now),
      jy: sp.jy,
      jm: sp.jm,
      jd: sp.jd
    };
    const updated = [...finance, tx];
    setFinance(updated);
    saveToLocalStorage('v3_finance', updated);
    
    const activityText = `${type === 'expense' ? 'هزینه: ' : 'درآمد: '} ${category} به مبلغ ${amount.toLocaleString('fa-IR')} تومان`;
    handleTrackActivity('finance', activityText);
    if (onPlaySound) onPlaySound();
  };

  const handleDeleteTransaction = (id: number) => {
    const updated = finance.filter((t) => t.id !== id);
    setFinance(updated);
    saveToLocalStorage('v3_finance', updated);
  };

  const handleAddSavingsGoal = (name: string, targetAmount: number) => {
    const goal: SavingsGoal = {
      id: `goal-${Date.now()}`,
      name,
      targetAmount,
      currentAmount: 0,
      createdAt: new Date().toISOString(),
    };
    const updated = [...savingsGoals, goal];
    setSavingsGoals(updated);
    saveToLocalStorage('v3_savings_goals', updated);
  };

  const handleAddToSavingsGoal = (id: string, amount: number) => {
    const updated = savingsGoals.map(g =>
      g.id === id ? { ...g, currentAmount: Math.min(g.targetAmount, g.currentAmount + amount) } : g
    );
    setSavingsGoals(updated);
    saveToLocalStorage('v3_savings_goals', updated);
  };

  const handleDeleteSavingsGoal = (id: string) => {
    const updated = savingsGoals.filter(g => g.id !== id);
    setSavingsGoals(updated);
    saveToLocalStorage('v3_savings_goals', updated);
  };

  const handleToggleGoalPin = (id: string) => {
    const updated = savingsGoals.map(g => g.id === id ? { ...g, pinnedHome: !g.pinnedHome } : g);
    setSavingsGoals(updated);
    saveToLocalStorage('v3_savings_goals', updated);
  };

  // Derived date & financial states
  const today = new Date();
  const todayKey = getLocalDateKey(today);
  const todayExtras = weekExtras[todayKey] || [];
  const shamsiNow = getShamsiParts(today);
  const monthlyTransactions = finance.filter((t) => t.jy === shamsiNow.jy && t.jm === shamsiNow.jm);

  return {
    ideas,
    todos,
    shopping,
    finance,
    savingsGoals,
    note,
    fixedDaily,
    weekExtras,
    lastActivity,
    today,
    todayKey,
    todayExtras,
    shamsiNow,
    monthlyTransactions,
    handleNoteChange,
    handleAddIdea,
    handleUpdateIdea,
    handleDeleteIdea,
    handleAddLink,
    handleUpdateLink,
    handleDeleteLink,
    handleAddImage,
    handleDeleteImage,
    handleAddExtra,
    handleToggleExtra,
    handleDeleteExtra,
    handleReorderExtras,
    handleUpdateFixedDaily,
    handleAddTask,
    handleToggleTask,
    handleDeleteTask,
    handleAddTransaction,
    handleDeleteTransaction,
    handleAddSavingsGoal,
    handleAddToSavingsGoal,
    handleDeleteSavingsGoal,
    handleToggleGoalPin,
    handleTrackActivity
  };
}
