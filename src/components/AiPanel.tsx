/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Sparkles, 
  Copy, 
  Check, 
  Trash2, 
  Calendar, 
  TrendingUp, 
  Lightbulb, 
  Zap, 
  ChevronDown, 
  MessageSquare,
  Plus,
  Search,
  Edit3,
  X,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { ChatMessage, ChatThread, Transaction, TaskItem, Idea, AppSettings } from '../types';
import MarkdownText from './MarkdownText';

export const AVAILABLE_AI_MODELS = [
  {
    id: 'balanced',
    name: 'دستیار جامع و متعادل',
    title: 'دستیار جامع و متعادل',
    badge: 'پیش‌فرض / هوشمند',
    desc: 'پاسخ‌های کامل، دقیق و کاربردی مناسب برای تمام سوالات و برنامه‌ریزی روزمره',
    color: 'from-purple-500 to-indigo-600',
    icon: Sparkles
  },
  {
    id: 'fast-concise',
    name: 'پاسخ سریع و فشرده',
    title: 'پاسخ سریع و فشرده',
    badge: 'خلاصه و مستقیم',
    desc: 'پاسخ‌های کوتاه، بدون مقدمه‌چینی، سریع و نکته‌محور در قالب بالت‌پوینت',
    color: 'from-amber-500 to-orange-600',
    icon: Zap
  },
  {
    id: 'deep-analysis',
    name: 'تحلیل عمیق و تخصصی',
    title: 'تحلیل عمیق و تخصصی',
    badge: 'جامع و استدلالی',
    desc: 'بررسی چندجانبه، استدلال دقیق، تحلیل منطقی و مالی با جزئیات کامل',
    color: 'from-blue-500 to-cyan-600',
    icon: TrendingUp
  },
  {
    id: 'step-by-step',
    name: 'گام‌به‌گام و آموزشی',
    title: 'گام‌به‌گام و آموزشی',
    badge: 'مرحله‌به‌مرحله',
    desc: 'تبدیل کارها و اهداف به مراحل اجرایی مشخص، شماره‌گذاری شده و عملیاتی',
    color: 'from-emerald-500 to-teal-600',
    icon: Check
  },
  {
    id: 'creative',
    name: 'خلاق و ایده‌پرداز',
    title: 'خلاق و ایده‌پرداز',
    badge: 'نوآورانه و ایده',
    desc: 'ایده‌پردازی نوآورانه، زاویه دیدهای جدید، پیشنهادهای هوشمندانه و جملات انگیزشی',
    color: 'from-pink-500 to-rose-600',
    icon: Lightbulb
  }
];

export const AVAILABLE_AI_STYLES = AVAILABLE_AI_MODELS;

interface AiPanelProps {
  key?: string;
  threads?: ChatThread[];
  activeThreadId?: string;
  onSelectThread?: (threadId: string) => void;
  onNewThread?: () => void;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  messages: ChatMessage[];
  isLoading: boolean;
  selectedModel?: string;
  onSelectModel?: (modelId: string) => void;
  onSendMessage: (promptText: string) => void;
  onClearHistory: () => void;
  fixedDaily?: string[];
  todayExtras?: { text: string; done: boolean }[];
  monthlyTransactions?: Transaction[];
  settings?: AppSettings;
  todos?: TaskItem[];
  shopping?: TaskItem[];
  ideas?: Idea[];
  note?: string;
}

export default function AiPanel({
  threads = [],
  activeThreadId = '',
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  messages,
  isLoading,
  selectedModel = 'balanced',
  onSelectModel,
  onSendMessage,
  onClearHistory,
  fixedDaily = [],
  todayExtras = [],
  monthlyTransactions = [],
  settings,
  todos = [],
  shopping = [],
  ideas = [],
  note = ''
}: AiPanelProps) {
  const isEn = settings?.language === 'en';
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showThreadsDrawer, setShowThreadsDrawer] = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [inputText]);

  const activeModelObj = AVAILABLE_AI_MODELS.find(m => m.id === selectedModel) || AVAILABLE_AI_MODELS[0];
  const currentThread = threads.find(t => t.id === activeThreadId) || threads[0];
  const ActiveIcon = activeModelObj.icon || Sparkles;

  const modelBadgeMap: Record<string, string> = {
    'پیش‌فرض / هوشمند': isEn ? 'Default / Smart' : 'پیش‌فرض / هوشمند',
    'خلاصه و مستقیم': isEn ? 'Short & Direct' : 'خلاصه و مستقیم',
    'جامع و استدلالی': isEn ? 'In-depth & Analytical' : 'جامع و استدلالی',
    'مرحله‌به‌مرحله': isEn ? 'Actionable Steps' : 'مرحله‌به‌مرحله',
    'نوآورانه و ایده': isEn ? 'Innovative & Ideas' : 'نوآورانه و ایده',
  };

  const modelDescMap: Record<string, string> = {
    'balanced': isEn ? 'Comprehensive, accurate, and practical responses for everyday tasks and planning' : 'پاسخ‌های کامل، دقیق و کاربردی مناسب برای تمام سوالات و برنامه‌ریزی روزمره',
    'fast-concise': isEn ? 'Short, direct, bulleted answers without unnecessary intro to save time' : 'پاسخ‌های کوتاه، بدون مقدمه‌چینی، سریع و نکته‌محور در قالب بالت‌پوینت',
    'deep-analysis': isEn ? 'Multi-faceted review, logical reasoning, and detailed financial and strategic analysis' : 'بررسی چندجانبه، استدلال دقیق، تحلیل منطقی و مالی با جزئیات کامل',
    'step-by-step': isEn ? 'Breaks down tasks and goals into clear, numbered, sequential actionable steps' : 'تبدیل کارها و اهداف به مراحل اجرایی مشخص، شماره‌گذاری شده و عملیاتی',
    'creative': isEn ? 'Innovative brainstorming, fresh perspectives, engaging suggestions and motivation' : 'ایده‌پردازی نوآورانه، زاویه دیدهای جدید، پیشنهادهای هوشمندانه و جملات انگیزشی',
  };

  const modelNameMap: Record<string, string> = {
    'balanced': isEn ? 'Balanced Assistant' : 'دستیار جامع و متعادل',
    'fast-concise': isEn ? 'Fast & Concise' : 'پاسخ سریع و فشرده',
    'deep-analysis': isEn ? 'Deep Analysis' : 'تحلیل عمیق و تخصصی',
    'step-by-step': isEn ? 'Step-by-Step Guide' : 'گام‌به‌گام و آموزشی',
    'creative': isEn ? 'Creative & Ideas' : 'خلاق و ایده‌پرداز',
  };

  const quickPrompts = [
    {
      id: 'schedule',
      label: isEn ? "Today's Schedule" : 'برنامه‌ریزی امروز',
      icon: Calendar,
      text: isEn ? 'Analyze my schedule and tasks for today and suggest a prioritized timetable.' : 'با توجه به برنامه‌ها و کارهای امروز من، یک اولویت‌بندی و جدول زمان‌بندی کاربردی پیشنهاد بده.'
    },
    {
      id: 'image_gen',
      label: isEn ? 'Can you generate images?' : 'میتونی عکس بسازی؟',
      icon: Lightbulb,
      text: isEn ? 'Can you generate images or provide creative image prompts?' : 'میتونی عکس یا طرح‌های تصویری خلاقانه ایجاد کنی؟'
    },
    {
      id: 'finance',
      label: isEn ? 'Monthly Finance Analysis' : 'تحلیل مالی ماهانه',
      icon: TrendingUp,
      text: isEn ? 'Review my monthly incomes and expenses and suggest savings strategies.' : 'وضعیت درآمدها و هزینه‌های این ماه من را بررسی کن و چند راهکار برای صرفه‌جویی بده.'
    },
    {
      id: 'summary',
      label: isEn ? 'Overall Status Summary' : 'خلاصه وضعیت کلی',
      icon: Zap,
      text: isEn ? 'Provide a quick summary of my pending tasks, notes, and today schedule.' : 'یک خلاصه‌ی سریع از کارهای مانده، یادداشت‌ها و برنامه‌های امروز من ارائه بده.'
    }
  ];

  // Auto scroll to bottom when messages change or loading state changes
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = (customText?: string) => {
    const text = customText || inputText.trim();
    if (!text || isLoading) return;
    onSendMessage(text);
    setInputText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startRenameThread = (thread: ChatThread) => {
    setEditingThreadId(thread.id);
    setEditingTitleText(thread.title);
  };

  const saveRenameThread = (threadId: string) => {
    if (editingTitleText.trim()) {
      onRenameThread?.(threadId, editingTitleText.trim());
    }
    setEditingThreadId(null);
  };

  const filteredThreads = threads.filter(t => 
    t.title.toLowerCase().includes(threadSearch.toLowerCase()) ||
    t.messages.some(m => m.text.toLowerCase().includes(threadSearch.toLowerCase()))
  );

  const renderThreadsPanelContent = (closeDrawer: boolean, listClassName: string) => (
    <>
      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-[var(--text3)]" />
        <input
          type="text"
          value={threadSearch}
          onChange={(e) => setThreadSearch(e.target.value)}
          placeholder={isEn ? 'Search chats...' : 'جستجو در گفتگوها...'}
          className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:border-purple-500/50"
        />
      </div>

      {/* New Thread CTA */}
      <button
        onClick={() => {
          onNewThread?.();
          if (closeDrawer) setShowThreadsDrawer(false);
        }}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>{isEn ? 'Start New Conversation' : 'شروع گفتگوی جدید (موضوع تازه)'}</span>
      </button>

      {/* Threads List */}
      <div className={listClassName}>
        {filteredThreads.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text3)]">
            {isEn ? 'No chats found.' : 'گفتگویی یافت نشد.'}
          </div>
        ) : (
          filteredThreads.map((t) => {
            const isActive = t.id === activeThreadId;
            const isEditing = editingThreadId === t.id;

            return (
              <div
                key={t.id}
                className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-500/15 border-purple-500/40 text-[var(--text)] shadow-xs'
                    : 'border-transparent hover:bg-[var(--sidebar-hover)] text-[var(--text2)]'
                }`}
                onClick={() => {
                  if (!isEditing) {
                    onSelectThread?.(t.id);
                    if (closeDrawer) setShowThreadsDrawer(false);
                  }
                }}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 pr-1">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-purple-400' : 'text-[var(--text3)]'}`} />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingTitleText}
                      onChange={(e) => setEditingTitleText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveRenameThread(t.id)}
                      onBlur={() => saveRenameThread(t.id)}
                      autoFocus
                      className="bg-[var(--card-bg)] text-xs text-[var(--text)] border border-purple-500/50 rounded-lg px-2 py-0.5 w-full focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="truncate text-right">
                      <span className="text-xs font-bold text-[var(--text)] block truncate">
                        {t.title}
                      </span>
                      <span className="text-[10px] text-[var(--text3)] flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {t.messages.length} {isEn ? 'messages' : 'پیام'} • {new Date(t.updatedAt).toLocaleDateString(isEn ? 'en-US' : 'fa-IR')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0 mr-1" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    <button
                      onClick={() => saveRenameThread(t.id)}
                      className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => startRenameThread(t)}
                      className="p-1 rounded text-[var(--text3)] hover:text-purple-400 hover:bg-purple-500/20"
                      title={isEn ? 'Rename' : 'تغییر نام'}
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}

                  {threads.length > 1 && (
                    <button
                      onClick={() => onDeleteThread?.(t.id)}
                      className="p-1 rounded text-[var(--text3)] hover:text-red-400 hover:bg-red-500/20"
                      title={isEn ? 'Delete chat' : 'حذف این گفتگو'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-row w-full max-w-6xl mx-auto gap-3 overflow-hidden relative min-h-0 h-full"
    >
      <aside className="hidden lg:flex flex-col w-64 shrink-0 rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] p-3 space-y-3 min-h-0 overflow-hidden order-last">
        <div className="flex items-center gap-2 px-1">
          <MessageSquare className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-[var(--text)]">{isEn ? 'Chats' : 'چت‌ها'}</h3>
        </div>
        {renderThreadsPanelContent(false, 'flex-1 min-h-0 overflow-y-auto space-y-1.5 scrollbar-none')}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 space-y-3 overflow-hidden relative min-h-0 h-full">
        {/* Backdrop overlay for popups */}
      {(showModelPicker || showThreadsDrawer) && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-all" 
          onClick={() => {
            setShowModelPicker(false);
            setShowThreadsDrawer(false);
          }} 
        />
      )}

      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 sm:px-4 py-2 border-b border-[var(--border)] shrink-0 relative">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-[var(--text)] flex items-center gap-1.5">
                <span>{currentThread ? currentThread.title : (isEn ? 'AI Assistant' : 'دستیار هوشمند')}</span>
                {currentThread && (
                  <button 
                    onClick={() => startRenameThread(currentThread)}
                    className="p-1 text-[var(--text3)] hover:text-purple-400 transition-colors rounded-md cursor-pointer"
                    title={isEn ? 'Edit conversation title' : 'ویرایش نام این گفتگو'}
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </h2>

              {settings?.aiProvider !== 'openai' && (
                <div className="relative z-50">
                  <button
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                    title={isEn ? 'Change Response Style' : 'تغییر سبک پاسخ‌دهی'}
                  >
                    <ActiveIcon className="w-3.5 h-3.5 text-purple-400" />
                    <span>{modelNameMap[activeModelObj.id] || activeModelObj.name}</span>
                    <ChevronDown className={`w-3 h-3 opacity-70 transition-transform duration-200 ${showModelPicker ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Model / Style Picker Popover */}
                  <AnimatePresence>
                    {showModelPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] p-2 rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] shadow-2xl z-50 space-y-1 backdrop-blur-2xl"
                      >
                        <div className="px-3 py-2 text-[11px] font-bold text-[var(--text3)] border-b border-[var(--border)] mb-1 flex items-center justify-between">
                          <span>{isEn ? 'Select Response Style' : 'انتخاب سبک پاسخ‌دهی'}</span>
                          <span className="text-[10px] text-purple-400 font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                            {isEn ? 'Smart Assistant' : 'دستیار هوشمند'}
                          </span>
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5 scrollbar-none">
                          {AVAILABLE_AI_MODELS.map((m) => {
                            const isSelected = m.id === selectedModel;
                            const ItemIcon = m.icon || Sparkles;
                            return (
                              <button
                                key={m.id}
                                onClick={() => {
                                  onSelectModel?.(m.id);
                                  setShowModelPicker(false);
                                }}
                                className={`w-full text-right p-2.5 rounded-xl transition-all cursor-pointer flex flex-col gap-1 border ${
                                  isSelected
                                    ? 'bg-purple-500/15 border-purple-500/40 text-[var(--text)] shadow-xs'
                                    : 'border-transparent hover:bg-[var(--sidebar-hover)] text-[var(--text2)]'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                                    <ItemIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    {modelNameMap[m.id] || m.title}
                                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-semibold shrink-0">
                                    {modelBadgeMap[m.badge] || m.badge}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[var(--text3)] leading-relaxed font-normal">
                                  {modelDescMap[m.id] || m.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          {/* Threads History Drawer Toggle Button */}
          <button
            onClick={() => setShowThreadsDrawer(!showThreadsDrawer)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-transparent hover:bg-[var(--sidebar-hover)] text-[var(--text2)] text-xs font-semibold transition-all cursor-pointer active:scale-95 lg:hidden"
            title={isEn ? 'View saved conversations' : 'مشاهده همه گفتگوهای ذخیره‌شده'}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isEn ? `My Chats (${threads.length})` : `گفتگوهای من (${threads.length})`}</span>
          </button>

          {/* New Chat Button */}
          <button
            onClick={() => {
              onNewThread?.();
              setShowThreadsDrawer(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-transparent hover:bg-[var(--sidebar-hover)] text-[var(--text2)] text-xs font-semibold transition-all cursor-pointer active:scale-95 lg:hidden"
            title={isEn ? 'Create new conversation' : 'ایجاد گفتگوی جدید'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isEn ? 'New Chat' : 'چت جدید'}</span>
          </button>

          {messages.length > 0 && (
            <button
              onClick={onClearHistory}
              className="p-1.5 rounded-xl hover:bg-red-500/15 text-[var(--text3)] hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
              title="پاکسازی پیام‌های این چت"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Threads Drawer (Side Panel / Overlay) */}
      <AnimatePresence>
        {showThreadsDrawer && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute top-16 right-0 left-0 sm:left-auto sm:w-96 z-50 bg-[var(--card-bg)] border border-[var(--border)] shadow-2xl rounded-2xl p-4 space-y-3 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-[var(--text)]">{isEn ? 'Chat History & Archive' : 'تاریخچه و آرشیو گفتگوها'}</h3>
              </div>
              <button
                onClick={() => setShowThreadsDrawer(false)}
                className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Permanent Memory Notice */}
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {isEn ? 'All your chats are saved permanently. You can return anytime and continue the discussion.' : 'تمام گفتگوهای شما به طور دائمی ذخیره می‌شوند. می‌توانید هر چند روز یکبار برگردید و ادامه همان گفتگو را دنبال کنید.'}
              </p>
            </div>

            {renderThreadsPanelContent(true, 'max-h-72 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-none')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Messages Area */}
      {messages.length === 0 ? (
        <div className="flex-1 overflow-hidden px-2 sm:px-4 flex flex-col items-center justify-center relative">
          <div className="flex flex-col items-center justify-center text-center p-2 sm:p-4 space-y-4 relative z-10 w-full max-w-lg">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <div className="space-y-1 max-w-md">
              <h3 className="text-2xl sm:text-3xl font-semibold text-[var(--text)]">
                {isEn 
                  ? (settings?.userName?.trim() ? `Hello ${settings.userName.trim()}!` : 'Hello!') 
                  : (settings?.userName?.trim() ? `سلام ${settings.userName.trim()}!` : 'سلام!')}
              </h3>
              <p className="text-xs text-[var(--text2)] leading-relaxed">
                {isEn ? 'I am your personal AI Assistant in Corely. Feel free to ask about your schedule, daily tasks, finances, or ideas.' : 'من دستیار هوشمند شما در Corely هستم. می‌توانید درباره برنامه‌ریزی، مدیریت کارهای روزانه، تحلیل مالی یا ایده‌ها از من سوال بپرسید.'}
              </p>
            </div>

            {/* Quick action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg pt-1">
              {quickPrompts.map((qp) => {
                const Icon = qp.icon;
                return (
                  <button
                    key={qp.id}
                    onClick={() => handleSend(qp.text)}
                    disabled={isLoading}
                    className="p-3 rounded-xl border border-[var(--border)] bg-[var(--input-bg)]/80 hover:bg-purple-500/10 hover:border-purple-500/40 text-right transition-all cursor-pointer flex items-center gap-3 group shadow-xs hover:shadow-md press-feedback"
                  >
                    <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400 group-hover:scale-105 transition-transform shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[var(--text)]">{qp.label}</span>
                      <span className="text-[10px] text-[var(--text3)] line-clamp-1">{qp.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-2 scrollbar-none relative">
          <div className="w-full max-w-3xl mx-auto space-y-7">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]">
                      <p className="text-sm leading-7 whitespace-pre-wrap select-text selectable" dir="auto">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start w-full">
                    <div className="w-full space-y-2">
                      <div className="text-sm leading-7 text-[var(--text)] select-text selectable">
                        <MarkdownText text={msg.text} />
                      </div>
                      <div className="flex justify-start">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="flex items-center gap-1 text-[11px] text-[var(--text3)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === msg.id ? (isEn ? 'Copied' : 'کپی شد') : (isEn ? 'Copy' : 'کپی')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1 py-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text3)] animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text3)] animate-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text3)] animate-pulse" style={{ animationDelay: '400ms' }} />
              </motion.div>
            )}

            <div ref={chatBottomRef} />
          </div>
        </div>
      )}

      {/* Input Box Area */}
      <div className="space-y-2 shrink-0 w-full max-w-3xl mx-auto">
        <div className="flex flex-col rounded-3xl bg-[var(--card-bg)] border border-[var(--border)] shadow-sm focus-within:border-purple-500/50 transition-colors px-4 pt-3 pb-2">
          <textarea
            ref={textareaRef}
            rows={1}
            dir="auto"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isEn ? "Write a new message or question (Shift+Enter for new line)..." : "پیام یا سوال جدید خود را بنویسید (Shift+Enter برای خط بعدی)..."}
            disabled={isLoading}
            className="w-full bg-transparent outline-none resize-none text-sm leading-7 text-[var(--text)] placeholder:text-[var(--text3)] max-h-[200px]"
          />
          <div className="flex items-center justify-end pt-1">
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isLoading}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={isEn ? "Send" : "ارسال"}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick prompt bar below input when messages exist */}
        {messages.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {quickPrompts.map((qp) => {
              const Icon = qp.icon;
              return (
                <button
                  key={qp.id}
                  onClick={() => handleSend(qp.text)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)] text-[11px] font-medium text-[var(--text2)] hover:text-[var(--text)] transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Icon className="w-3 h-3 text-purple-400 shrink-0" />
                  <span>{qp.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </motion.div>
  );
}
