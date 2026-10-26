/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Send, Bot, Lightbulb, TrendingUp, Calendar, Zap, CheckCircle2 } from 'lucide-react';
import { Transaction, AppSettings } from '../types';

interface HomeAiAssistantProps {
  onAskAi: (promptText: string) => void;
  fixedDaily?: string[];
  todayExtras?: { text: string; done: boolean }[];
  monthlyTransactions?: Transaction[];
  settings?: AppSettings;
  todos?: { text: string; done: boolean; priority?: string }[];
  shopping?: { text: string; done: boolean; priority?: string }[];
  ideas?: { title: string; desc?: string; status: number }[];
  note?: string;
}

export default function HomeAiAssistant({
  onAskAi,
  fixedDaily = [],
  todayExtras = [],
  monthlyTransactions = [],
  settings,
  todos = [],
  shopping = [],
  ideas = [],
  note = ''
}: HomeAiAssistantProps) {
  const [prompt, setPrompt] = useState('');
  const [, setIsHovered] = useState(false);

  const isEn = settings?.language === 'en';

  const quickPrompts = [
    {
      id: 'schedule',
      label: isEn ? "Today's Schedule" : 'برنامه‌ریزی امروز',
      desc: isEn ? 'Schedule & task priorities' : 'زمان‌بندی و اولویت کارهای امروز',
      icon: Calendar,
      text: isEn ? 'Analyze my schedule and tasks for today and suggest a prioritized timetable.' : 'با توجه به کارهای ثابت و برنامه‌های امروز من، یک اولویت‌بندی دقیق و زمان‌بندی پیشنهادی تنظیم کن.'
    },
    {
      id: 'summary',
      label: isEn ? 'Status Summary' : 'خلاصه وضعیت',
      desc: isEn ? 'Quick look at tasks & notes' : 'نگاه سریع به کارهام و یادداشت‌ها',
      icon: Zap,
      text: isEn ? 'Provide a quick summary of my pending tasks, notes, and today schedule.' : 'یک خلاصه‌ کاربردی و فشرده از برنامه‌های امروز، خریدهای مانده و یادداشت‌های من ارائه کن.'
    },
    {
      id: 'finance',
      label: isEn ? 'Financial Analysis' : 'تحلیل مالـی',
      desc: isEn ? 'Monthly income & expenses' : 'بررسی درآمدها و هزینه‌های ماه',
      icon: TrendingUp,
      text: isEn ? 'Review my monthly incomes and expenses and suggest savings strategies.' : 'تراکنش‌ها و هزینه‌های این ماه من را بررسی کن و چند پیشنهاد برتر برای مدیریت بودجه بده.'
    },
    {
      id: 'ideas',
      label: isEn ? 'Ideas & Motivation' : 'ایده و انگیزه',
      desc: isEn ? 'Motivational quote & ideas' : 'پیشنهاد ایده مکمل و انرژی‌بخش',
      icon: Lightbulb,
      text: isEn ? 'Based on my saved ideas and goals, suggest a complementary idea and next actionable step.' : 'یک جمله انگیزشی خوب بگو و بر اساس ایده‌های ثبت‌شده‌ من، یک ایده جذاب مکمل پیشنهاد بده.'
    }
  ];

  const handleSend = (customText?: string) => {
    const textToSend = customText || prompt.trim();
    if (!textToSend) return;
    onAskAi(textToSend);
    setPrompt('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative overflow-hidden rounded-3xl border border-purple-500/20 dark:border-purple-500/30 bg-[var(--card-bg)] backdrop-blur-xl p-5 sm:p-5.5 shadow-xl shadow-purple-500/5 transition-all duration-300 space-y-4 group flex flex-col justify-between h-full"
    >
      {/* Soft Ambient Mesh Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-purple-500/15 via-indigo-500/10 to-transparent blur-3xl pointer-events-none -z-10 group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-gradient-to-tr from-blue-500/10 via-purple-500/5 to-transparent blur-2xl pointer-events-none -z-10" />

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2.5 border-b border-[var(--border)] pb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Glowing Bot Avatar */}
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-[var(--card-bg)]"></span>
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-[var(--text)] tracking-tight truncate">
                  {isEn ? 'Personal AI Assistant' : 'دستیار هوشمند شخصی'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/15 text-purple-500 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                  AI
                </span>
              </div>
              <p className="text-[11px] text-[var(--text3)] mt-0.5 line-clamp-1">
                {isEn ? 'Instant answers based on your daily data' : 'پاسخگویی آنی بر اساس داده‌های روزانه و برنامه‌ها'}
              </p>
            </div>
          </div>

          {/* Status context pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-2xl bg-[var(--sidebar-hover)] border border-[var(--border)] text-[10.5px] text-[var(--text2)] font-bold shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
            <span>{isEn ? 'Ready' : 'آماده همراهی'}</span>
          </div>
        </div>

        {/* Soft Quick Prompts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
          {quickPrompts.map((qp) => {
            const Icon = qp.icon;
            return (
              <button
                key={qp.id}
                onClick={() => handleSend(qp.text)}
                className="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-2xl border border-[var(--border)] bg-[var(--sidebar-hover)] hover:bg-[var(--card-bg)] hover:border-purple-500/40 text-right transition-all duration-200 cursor-pointer group/qp shadow-xs hover:shadow-md hover:shadow-purple-500/5 active:scale-98"
              >
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 group-hover/qp:bg-purple-500 group-hover/qp:text-white transition-all shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-black text-[var(--text)] group-hover/qp:text-purple-500 dark:group-hover/qp:text-purple-400 transition-colors truncate selectable">
                    {qp.label}
                  </span>
                  <span className="block text-[10px] text-[var(--text3)] line-clamp-1 mt-0.5 selectable">
                    {qp.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Composer Box */}
      <div className="pt-1">
        <div className="relative flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--input-border)] focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all shadow-inner">
          <Sparkles className="w-4.5 h-4.5 text-purple-400 mr-2 shrink-0 animate-pulse" />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isEn ? "Ask anything or request scheduling guidance..." : "هر سؤالی دارید یا درخواست برنامه‌ریزی و راهنمایی بنویسید..."}
            className="w-full bg-transparent text-xs text-[var(--text)] placeholder:[var(--text3)] outline-none py-2 font-medium"
          />
          <button
            onClick={() => handleSend()}
            disabled={!prompt.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-30 disabled:hover:from-purple-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-purple-500/20 shrink-0 active:scale-95"
            title={isEn ? "Send to AI Assistant" : "ارسال مستقیم به دستیار"}
          >
            <span>{isEn ? "Ask" : "پرسش"}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

