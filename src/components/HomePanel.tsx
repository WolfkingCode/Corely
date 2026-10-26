/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  formatShamsi, 
  DAYS_EN, 
  MONTHS_EN, 
  DAYS_FA, 
  dbGetGoalImages
} from '../lib/utils';
import { LastActivity, WeekExtra, Transaction, TaskItem, Idea, AppSettings, GoalImageItem, GoalImageTransform, DEFAULT_GOAL_IMAGE_TRANSFORM, SavingsGoal } from '../types';
import { Wallet, ArrowUpRight, CalendarDays, Circle, CheckCircle2, ArrowLeft, ListTodo, ShoppingCart, Target } from 'lucide-react';
import HomeAiAssistant from './HomeAiAssistant';
import PomodoroTimer from './PomodoroTimer';
import HabitsWidget from './HabitsWidget';

interface HomePanelProps {
  key?: string;
  lastActivity: LastActivity | null;
  fixedDaily: string[];
  todayExtras: WeekExtra[];
  onToggleTodayExtra: (idx: number) => void;
  monthlyTransactions: Transaction[];
  onNavigateToPanel: (panelName: string) => void;
  onAskAi: (promptText: string) => void;
  settings?: AppSettings;
  todos?: TaskItem[];
  shopping?: TaskItem[];
  onToggleTask?: (type: 'todos' | 'shopping', idx: number) => void;
  ideas?: Idea[];
  note?: string;
  hideGoalImages?: boolean;
  savingsGoals?: SavingsGoal[];
}

// Relaxed clamp for goal image transform: allows bleed edge effects (half out, half in)
// while preventing completely off-screen states (-10% to 110%)
function clampGoalTransform(transform: GoalImageTransform): GoalImageTransform {
  const size = Math.max(5, Math.min(60, transform.sizePercent || DEFAULT_GOAL_IMAGE_TRANSFORM.sizePercent));
  const deg = transform.rotationDeg || 0;
  
  const rawX = typeof transform.xPercent === 'number' ? transform.xPercent : DEFAULT_GOAL_IMAGE_TRANSFORM.xPercent;
  const rawY = typeof transform.yPercent === 'number' ? transform.yPercent : DEFAULT_GOAL_IMAGE_TRANSFORM.yPercent;
  
  // Relaxed boundary: allow center of image between -5% and 105% so parts can hang off-screen
  const clampedX = Math.max(-5, Math.min(105, rawX));
  const clampedY = Math.max(-5, Math.min(105, rawY));
  
  return {
    xPercent: Math.round(clampedX * 10) / 10,
    yPercent: Math.round(clampedY * 10) / 10,
    sizePercent: Math.round(size * 10) / 10,
    rotationDeg: deg
  };
}

export default function HomePanel({
  savingsGoals = [],
  fixedDaily,
  todayExtras,
  onToggleTodayExtra,
  monthlyTransactions,
  onNavigateToPanel,
  onAskAi,
  settings,
  todos = [],
  shopping = [],
  onToggleTask,
  ideas = [],
  note = '',
  hideGoalImages = false
}: HomePanelProps) {
  const [timeStr, setTimeStr] = useState('');
  const [ampmStr, setAmpmStr] = useState('');
  const [dateTopStr, setDateTopStr] = useState('');
  const [dateBottomStr, setDateBottomStr] = useState('');
  const [greeting, setGreeting] = useState('');
  const [goalImages, setGoalImages] = useState<GoalImageItem[]>([]);

  // Load Goal Images from IndexedDB
  useEffect(() => {
    let isMounted = true;
    const fetchImages = () => {
      dbGetGoalImages().then((imgs) => {
        if (isMounted) setGoalImages(imgs || []);
      });
    };

    fetchImages();

    const handleGoalImagesUpdate = () => {
      fetchImages();
    };

    window.addEventListener('goal-images-updated', handleGoalImagesUpdate);
    window.addEventListener('goal-image-updated', handleGoalImagesUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('goal-images-updated', handleGoalImagesUpdate);
      window.removeEventListener('goal-image-updated', handleGoalImagesUpdate);
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, '0');
      
      // Clock format 12h vs 24h
      if (settings?.clockFormat === '12h') {
        const hrs12 = hrs % 12 || 12;
        const ampm = hrs >= 12 ? 'ب.ظ' : 'ق.ظ';
        setTimeStr(`${hrs12.toString().padStart(2, '0')}:${mins}`);
        setAmpmStr(ampm);
      } else {
        setTimeStr(`${hrs.toString().padStart(2, '0')}:${mins}`);
        setAmpmStr('');
      }
      
      const gregStr = `${DAYS_EN[now.getDay()]}, ${now.getDate()} ${MONTHS_EN[now.getMonth()]}`;
      const jalaliStr = `${DAYS_FA[now.getDay()]} ${formatShamsi(now)}`;

      // Calendar type preference
      if (settings?.calendarType === 'gregorian') {
        setDateTopStr(gregStr);
        setDateBottomStr(jalaliStr);
      } else {
        // Default Jalali on top
        setDateTopStr(jalaliStr);
        setDateBottomStr(gregStr);
      }

      // Greeting with user name
      const trimmedName = settings?.userName?.trim();
      const name = trimmedName ? `, ${trimmedName}` : '';
      const isEn = settings?.language === 'en';
      if (hrs < 6) setGreeting(isEn ? `Good night${name}` : `شب خوش${name}`);
      else if (hrs < 12) setGreeting(isEn ? `Good morning${name}` : `صبح بخیر${name}`);
      else if (hrs < 17) setGreeting(isEn ? `Good afternoon${name}` : `ظهر بخیر${name}`);
      else if (hrs < 20) setGreeting(isEn ? `Good evening${name}` : `عصر بخیر${name}`);
      else setGreeting(isEn ? `Good night${name}` : `شب بخیر${name}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [settings?.clockFormat, settings?.calendarType, settings?.userName]);

  // Compute monthly calculations for home widget
  const totalIncome = monthlyTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = monthlyTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const isEn = settings?.language === 'en';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 relative overflow-hidden min-w-0 w-full"
    >
      {/* Floating Goal Images (Full Page Canvas, z-10 over card backgrounds, pointer-events-none) */}
      {!hideGoalImages && goalImages.filter((img) => img.enabled !== false).map((img) => {
        const rawTransform = img.transform || DEFAULT_GOAL_IMAGE_TRANSFORM;
        const transform = clampGoalTransform(rawTransform);
        return (
          <div 
            key={img.id}
            className="absolute z-10 select-none pointer-events-none transition-all duration-150 ease-out"
            style={{
              left: `${transform.xPercent}%`,
              top: `${transform.yPercent}%`,
              width: `${transform.sizePercent}%`,
              transform: `translate(-50%, -50%) rotate(${transform.rotationDeg || 0}deg)`,
              maxWidth: '500px',
              minWidth: '24px'
            }}
          >
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              src={img.dataUrl}
              alt="Goal"
              className="w-full h-auto object-contain drop-shadow-none"
            />
          </div>
        );
      })}

      {/* Unified Clock + Today's Schedule Section */}
      <div className="home-clock-section relative">
        <div className="home-clock-section-bg" aria-hidden="true"></div>
        <div className="home-clock-grid relative z-20">
          {/* Today's Schedule List (beside the clock) */}
          <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--input-bg)]/40 p-3 w-full select-text">
            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-[var(--text)]">
              <CalendarDays className="w-4 h-4 text-violet-500 dark:text-violet-400" />
              {isEn ? "Today's Plan" : 'برنامه امروز'}
            </div>
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
              {fixedDaily.map((item, i) => (
                <div key={`f-${i}`} className="flex items-center gap-2.5 py-1 text-xs text-[var(--text2)]">
                  <Circle className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  <span className="truncate">{item}</span>
                </div>
              ))}
              {todayExtras.map((extra, i) => (
                <div
                  key={extra.id}
                  onClick={() => onToggleTodayExtra(i)}
                  className="flex items-center gap-2.5 py-1 text-xs cursor-pointer"
                >
                  {extra.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  )}
                  <span className={`truncate ${extra.done ? 'line-through text-[var(--text3)]' : 'text-[var(--text2)]'}`}>{extra.text}</span>
                </div>
              ))}
              {fixedDaily.length === 0 && todayExtras.length === 0 && (
                <span className="text-xs text-[var(--text3)] py-3 text-center block">{isEn ? 'No plans added yet' : 'هنوز برنامه‌ای اضافه نشده است'}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigateToPanel('week')}
              className="mt-3 pt-3 border-t border-[var(--border)] w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-violet-600 dark:text-violet-400 cursor-pointer"
            >
              {isEn ? 'View full weekly plan' : 'مشاهده کامل برنامه'}
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Center Clock & Greetings & Goals & Balance */}
          <div className="flex flex-col items-center text-center w-full">
            <div className="home-greeting font-medium" style={{ marginRight: '3px' }}>{greeting}</div>
            <div className="home-date-top text-sm font-semibold">{dateTopStr}</div>
            <div className="home-clock my-2 select-none">
              <span className="relative inline-block">
                <span>{timeStr}</span>
                {ampmStr && (
                  <span
                    className={`absolute bottom-1 sm:bottom-1.5 text-base sm:text-lg font-normal whitespace-nowrap ${
                      isEn ? 'left-full ml-2' : 'right-full mr-2'
                    }`}
                    style={{ letterSpacing: 'normal' }}
                  >
                    {ampmStr}
                  </span>
                )}
              </span>
            </div>
            <div className="home-date-bottom text-sm font-medium">{dateBottomStr}</div>

            {/* Pinned Savings Goals under Date */}
            {savingsGoals.filter(g => g.pinnedHome).length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 max-w-[90%] sm:max-w-md">
                {savingsGoals.filter(g => g.pinnedHome).map(goal => {
                  const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                  const isDone = goal.currentAmount >= goal.targetAmount;
                  return (
                    <motion.div
                      key={goal.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => onNavigateToPanel('finance')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--input-bg)]/80 hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-[11px] text-[var(--text3)] hover:text-[var(--text)] transition-all cursor-pointer group shadow-xs truncate"
                      title={isEn ? 'Click to open Finance' : 'برای رفتن به مدیریت مالی کلیک کنید'}
                    >
                      <Target className={`w-3 h-3 shrink-0 ${isDone ? 'text-emerald-500' : 'text-purple-400'}`} />
                      <span className="font-semibold text-[var(--text2)] shrink-0 truncate max-w-[80px]">
                        {goal.name}
                      </span>
                      <div className="relative w-10 h-1.5 rounded-full bg-[var(--border)] overflow-hidden shrink-0">
                        <div
                          className={`absolute inset-y-0 right-0 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-purple-400'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 ${isDone ? 'text-emerald-500' : 'text-purple-400'}`}>
                        {isDone ? (isEn ? 'Ready!' : 'آماده!') : `${percent}%`}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Monthly Finance Balance Badge */}
            {monthlyTransactions && monthlyTransactions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onNavigateToPanel('finance')}
                className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-[var(--input-bg)]/80 hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-[11px] text-[var(--text3)] hover:text-[var(--text)] transition-all cursor-pointer group shadow-xs max-w-[90%] sm:max-w-md truncate"
                title={isEn ? 'Click to open Financial Management' : 'برای رفتن به مدیریت مالی کلیک کنید'}
              >
                <Wallet className={`w-3 h-3 shrink-0 ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
                <span className="font-semibold text-[var(--text2)] shrink-0">
                  {isEn ? 'Monthly balance:' : 'تراز این ماه:'}
                </span>
                <span className={`font-bold shrink-0 ${balance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  {settings?.privacyMode 
                    ? '****' 
                    : `${balance > 0 ? '+' : ''}${balance.toLocaleString(isEn ? 'en-US' : 'fa-IR')} ${isEn ? 'Toman' : 'تومان'}`}
                </span>
                <ArrowUpRight className="w-3 h-3 text-[var(--text3)] group-hover:text-[var(--text)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
              </motion.div>
            )}
          </div>

          {/* Tasks & Shopping Mini Lists (right side of clock) */}
          <div className="w-full flex flex-col gap-2 select-text">
            {/* Tasks Mini List */}
            <div
              onClick={() => onNavigateToPanel('tasks')}
              className="relative rounded-2xl border border-[var(--border)] bg-[var(--input-bg)]/40 p-2.5 w-full cursor-pointer hover:border-violet-500/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-[var(--text)]">
                <ListTodo className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
                {isEn ? 'Tasks' : 'کارها'}
              </div>
              <div className="flex flex-col gap-1 max-h-16 overflow-y-auto">
                {todos.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-[var(--text2)]">
                    <Circle className={`w-3 h-3 shrink-0 ${item.done ? 'text-emerald-500' : 'opacity-50'}`} />
                    <span className={`truncate ${item.done ? 'line-through text-[var(--text3)]' : ''}`}>{item.text}</span>
                  </div>
                ))}
                {todos.length === 0 && (
                  <span className="text-[11px] text-[var(--text3)]">{isEn ? 'No tasks' : 'کاری نیست'}</span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center justify-center gap-1.5 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                {isEn ? 'View all tasks' : 'مشاهده کامل کارها'}
                <ArrowLeft className="w-3 h-3" />
              </div>
            </div>

            {/* Shopping Mini List */}
            <div
              onClick={() => onNavigateToPanel('shopping')}
              className="relative rounded-2xl border border-[var(--border)] bg-[var(--input-bg)]/40 p-2.5 w-full cursor-pointer hover:border-violet-500/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-[var(--text)]">
                <ShoppingCart className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
                {isEn ? 'Shopping' : 'خرید'}
              </div>
              <div className="flex flex-col gap-1 max-h-16 overflow-y-auto">
                {shopping.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-[var(--text2)]">
                    <Circle className={`w-3 h-3 shrink-0 ${item.done ? 'text-emerald-500' : 'opacity-50'}`} />
                    <span className={`truncate ${item.done ? 'line-through text-[var(--text3)]' : ''}`}>{item.text}</span>
                  </div>
                ))}
                {shopping.length === 0 && (
                  <span className="text-[11px] text-[var(--text3)]">{isEn ? 'List is empty' : 'لیست خالیه'}</span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center justify-center gap-1.5 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                {isEn ? 'View shopping list' : 'مشاهده کامل خرید'}
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 2-Column Section: AI Assistant (Right in RTL) & Pomodoro Timer (Left in RTL) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch relative z-20">
        {/* AI Assistant Widget */}
        <div className="flex flex-col h-full">
          <HomeAiAssistant
            onAskAi={onAskAi}
            fixedDaily={fixedDaily}
            todayExtras={todayExtras}
            monthlyTransactions={monthlyTransactions}
            settings={settings}
            todos={todos}
            shopping={shopping}
            ideas={ideas}
            note={note}
          />
        </div>

        {/* 25-Minute Focus Pomodoro Timer */}
        <div className="flex flex-col h-full">
          <PomodoroTimer isEn={isEn} />
        </div>
      </div>

      {/* Bottom Section: Habits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch relative z-20">
        <div className="flex flex-col h-full">
          <HabitsWidget
            onNavigateToHabits={() => onNavigateToPanel('habits')}
            settings={settings}
          />
        </div>
      </div>
    </motion.div>
  );
}
