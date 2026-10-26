import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  MoveRight, 
  MoveLeft, 
  Trash2, 
  X, 
  Pencil, 
  Sparkles, 
  Target, 
  CheckCircle2, 
  Zap, 
  Sun, 
  Bot, 
  Clock, 
  User, 
  RotateCcw, 
  Loader2, 
  AlertCircle, 
  CheckSquare, 
  Square, 
  CheckCheck, 
  GraduationCap, 
  Briefcase, 
  Laptop, 
  Settings2, 
  Circle 
} from 'lucide-react';
import { WeekExtras, WeekExtra, AppSettings } from '../types';
import { DAYS_FA, DAYS_EN, getLocalDateKey, getShamsiParts, SHAMSI_MONTHS, getGeminiKey, getAiProxyUrl, getAiProviderConfig } from '../lib/utils';
import { isDesktopApp } from '../lib/notifications';
import TimePicker from './TimePicker';

interface WeekPanelProps {
  key?: string;
  fixedDaily: string[];
  onUpdateFixedDaily: (newFixed: string[]) => void;
  weekExtras: WeekExtras;
  onAddExtra: (key: string, text: string) => void;
  onToggleExtra: (key: string, idx: number) => void;
  onDeleteExtra: (key: string, idx: number) => void;
  onReorderExtras?: (key: string, newExtras: WeekExtra[]) => void;
  settings?: AppSettings;
}

export default function WeekPanel({
  fixedDaily,
  onUpdateFixedDaily,
  weekExtras,
  onAddExtra,
  onToggleExtra,
  onDeleteExtra,
  onReorderExtras,
  settings
}: WeekPanelProps) {
  const isEn = settings?.language === 'en';
  
  const [extraInputs, setExtraInputs] = useState<Record<string, string>>({});
  
  // Fixed Daily Edit & Accordion States
  const [isFixedRoutinesOpen, setIsFixedRoutinesOpen] = useState(false);
  const [newFixedTask, setNewFixedTask] = useState('');
  const [editingFixedIdx, setEditingFixedIdx] = useState<number | null>(null);
  const [editingFixedText, setEditingFixedText] = useState('');

  // AI Routine Suggestions Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiRole, setAiRole] = useState(isEn ? 'Student' : 'دانش‌آموز');
  const [customAiRole, setCustomAiRole] = useState('');
  const [aiWakeTime, setAiWakeTime] = useState('07:00');
  const [aiSleepTime, setAiSleepTime] = useState('23:30');
  const [isCustomWakeTime, setIsCustomWakeTime] = useState(false);
  const [isCustomSleepTime, setIsCustomSleepTime] = useState(false);
  const [aiPriorities, setAiPriorities] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ id: string; text: string; checked: boolean }>>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editingSuggestionText, setEditingSuggestionText] = useState('');
  const [newCustomSuggestionText, setNewCustomSuggestionText] = useState('');

  const iranWeekOrder = [6, 0, 1, 2, 3, 4, 5]; // شنبه تا جمعه
  const today = new Date();
  const todayDow = today.getDay();
  const satOffset = todayDow >= 6 ? 0 : todayDow + 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - satOffset);

  // End of week (Friday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const weekDaysInfo = iranWeekOrder.map((dow, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = getLocalDateKey(d);
    const extras = weekExtras[key] || [];
    const isToday = d.toDateString() === today.toDateString();
    const parts = getShamsiParts(d);
    const shamsiDate = parts.jd;
    const shamsiMonth = SHAMSI_MONTHS[parts.jm - 1];

    return {
      dow,
      dateObj: d,
      key,
      extras,
      isToday,
      shamsiDate,
      shamsiMonth,
      dayName: isEn ? DAYS_EN[dow] : DAYS_FA[dow]
    };
  });

  const addExtra = (key: string) => {
    const txt = (extraInputs[key] || '').trim();
    if (!txt) return;

    onAddExtra(key, txt);
    setExtraInputs({ ...extraInputs, [key]: '' });
  };

  const moveFixedItem = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= fixedDaily.length) return;

    const list = [...fixedDaily];
    const item = list.splice(index, 1)[0];
    list.splice(newIndex, 0, item);
    
    onUpdateFixedDaily(list);
  };

  const moveExtraItem = (key: string, index: number, dir: -1 | 1) => {
    const currentExtras = weekExtras[key] || [];
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= currentExtras.length) return;
    const list = [...currentExtras];
    const temp = list[index];
    list[index] = list[newIndex];
    list[newIndex] = temp;
    if (onReorderExtras) {
      onReorderExtras(key, list);
    }
  };

  const addFixedItem = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onUpdateFixedDaily([...fixedDaily, trimmed]);
    setNewFixedTask('');
  };

  const startEditFixed = (idx: number) => {
    setEditingFixedIdx(idx);
    setEditingFixedText(fixedDaily[idx] || '');
  };

  const saveEditFixed = (idx: number) => {
    const trimmed = editingFixedText.trim();
    if (!trimmed) return;
    const updated = [...fixedDaily];
    updated[idx] = trimmed;
    onUpdateFixedDaily(updated);
    setEditingFixedIdx(null);
    setEditingFixedText('');
  };

  const cancelEditFixed = () => {
    setEditingFixedIdx(null);
    setEditingFixedText('');
  };

  const deleteFixedItem = (idx: number) => {
    const updated = fixedDaily.filter((_, i) => i !== idx);
    onUpdateFixedDaily(updated);
    if (editingFixedIdx === idx) {
      cancelEditFixed();
    }
  };

  // AI Assistant Handlers
  const handleOpenAiModal = () => {
    setIsAiModalOpen(true);
    setAiError(null);
  };

  const handleCloseAiModal = () => {
    setIsAiModalOpen(false);
    setAiError(null);
  };

  const handleGenerateAiSuggestions = async () => {
    setAiLoading(true);
    setAiError(null);

    const isOtherRole = aiRole === 'دیگر' || aiRole === 'Other';
    const resolvedRole = isOtherRole 
      ? (customAiRole.trim() || (isEn ? 'General' : 'عمومی'))
      : aiRole;

    try {
      const cfg = getAiProviderConfig();
      const apiKey = getGeminiKey();
      const aiProxyUrl = getAiProxyUrl();
      let data: { suggestions?: string[]; error?: string };

      if (isDesktopApp() && (window as any).corelyDesktop?.ai?.generateRoutineSuggestions) {
        try {
          data = await (window as any).corelyDesktop.ai.generateRoutineSuggestions({
            role: resolvedRole,
            wakeTime: aiWakeTime,
            sleepTime: aiSleepTime,
            priorities: aiPriorities.trim(),
            geminiApiKey: apiKey,
            aiProxyUrl,
            aiProvider: cfg.provider,
            openaiBaseUrl: cfg.baseUrl,
            openaiApiKey: cfg.apiKey,
            openaiModel: cfg.model
          });
        } catch (err) {
          data = { error: err instanceof Error ? err.message : 'خطا در ارتباط با هوش مصنوعی.' };
        }
      } else {
        data = {
          error: isEn
            ? 'The AI assistant is only available in the desktop version.'
            : 'دستیار هوشمند فقط در نسخه دسکتاپ فعال است.'
        };
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        const items = data.suggestions.map((s: string, idx: number) => ({
          id: `sug-${Date.now()}-${idx}`,
          text: s,
          checked: true
        }));
        setAiSuggestions(items);
        setHasGenerated(true);
      } else {
        throw new Error(isEn ? 'No suggestions were returned, please try again.' : 'پیشنهادی بازگردانده نشد، لطفاً مجدداً امتحان کنید.');
      }
    } catch (err: unknown) {
      console.error('Error generating AI routine suggestions:', err);
      const msg = err instanceof Error ? err.message : (isEn ? 'An unexpected error occurred.' : 'خطای پیش‌بینی‌نشده‌ای در ارتباط با هوش مصنوعی رخ داد.');
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleToggleSuggestion = (id: string) => {
    setAiSuggestions(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleToggleSelectAllSuggestions = () => {
    const allChecked = aiSuggestions.every(item => item.checked);
    setAiSuggestions(prev => prev.map(item => ({ ...item, checked: !allChecked })));
  };

  const handleDeleteSuggestionItem = (id: string) => {
    setAiSuggestions(prev => prev.filter(item => item.id !== id));
  };

  const handleStartEditSuggestion = (id: string, currentText: string) => {
    setEditingSuggestionId(id);
    setEditingSuggestionText(currentText);
  };

  const handleSaveEditSuggestion = (id: string) => {
    const trimmed = editingSuggestionText.trim();
    if (!trimmed) return;
    setAiSuggestions(prev => prev.map(item => item.id === id ? { ...item, text: trimmed } : item));
    setEditingSuggestionId(null);
    setEditingSuggestionText('');
  };

  const handleAddCustomSuggestionItem = () => {
    const trimmed = newCustomSuggestionText.trim();
    if (!trimmed) return;
    const newItem = {
      id: `sug-custom-${Date.now()}`,
      text: trimmed,
      checked: true
    };
    setAiSuggestions(prev => [...prev, newItem]);
    setNewCustomSuggestionText('');
  };

  const handleApplySelectedSuggestions = () => {
    const selectedTexts = aiSuggestions
      .filter(item => item.checked && item.text.trim())
      .map(item => item.text.trim());

    if (selectedTexts.length === 0) return;

    // Filter out duplicates if already existing in fixedDaily to keep it clean
    const uniqueNewItems = selectedTexts.filter(txt => !fixedDaily.includes(txt));
    const finalList = uniqueNewItems.length > 0 ? [...fixedDaily, ...uniqueNewItems] : [...fixedDaily, ...selectedTexts];

    onUpdateFixedDaily(finalList);
    setIsAiModalOpen(false);
    setIsFixedRoutinesOpen(true);
  };

  const roleOptions = isEn ? [
    'Student',
    'University Student',
    'Employee / Office Worker',
    'Freelancer',
    'Gamer / Streamer',
    'Athlete / Fitness',
    'Content Creator',
    'Other'
  ] : [
    'دانش‌آموز',
    'دانشجو',
    'کارمند',
    'فریلنسر',
    'گیمر / استریمر',
    'ورزشکار',
    'تولیدکننده محتوا',
    'دیگر'
  ];

  // 3 Complete Offline Default Routine Packages (No AI/Internet needed)
  const defaultOfflinePackages = [
    {
      id: 'student',
      title: isEn ? 'Student Routine' : 'برنامه دانش‌آموزی / دانشجویی',
      subtitle: isEn ? 'Focus on study, classes & daily balance' : 'تمرکز بر درس، کلاس‌ها و تعادل روزانه',
      icon: GraduationCap,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
      btnColor: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
      routines: isEn ? [
        '🌅 10-min Morning stretch & glass of water',
        '🎒 Pack backpack & review daily class schedule',
        '📖 45-min Deep study session (Pomodoro)',
        '✍️ Complete homework & practice exercises',
        '📚 15-min Book or English reading',
        '🧘 10-min Wind-down & prepare for tomorrow'
      ] : [
        '🌅 ۱۰ دقیقه نرمش صبحگاهی و نوشیدن یک لیوان آب',
        '🎒 بررسی برنامه کلاسی و آماده‌سازی وسایل',
        '📖 ۴۵ دقیقه مطالعه عمیق و تمرکز (پومودورو)',
        '✍️ حل تکالیف، تمرینات و مرور درس‌های روز',
        '📚 ۱۵ دقیقه مطالعه آزاد یا تمرین زبان انگلیسی',
        '🧘 ۱۰ دقیقه جمع‌بندی روز و خواب سر ساعت'
      ]
    },
    {
      id: 'employee',
      title: isEn ? 'Employee & Office' : 'برنامه کارمندی و شغلی',
      subtitle: isEn ? 'Work-life balance, health & organization' : 'سازماندهی وظایف کاری، سلامت جسم و تعادل',
      icon: Briefcase,
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
      btnColor: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
      routines: isEn ? [
        '☕ Healthy breakfast & review top 3 work priorities',
        '📧 Process emails and team communication',
        '🎯 90-min High-focus work block without distractions',
        '🚶‍♂️ 15-min Ergonomic stretch and short walk',
        '💧 Drink water regularly throughout work hours',
        '📋 End-of-day task wrap-up & plan next day'
      ] : [
        '☕ صبحانه سالم و یادداشت ۳ اولویت مهم کاری روز',
        '📧 بررسی ایمیل‌ها، پیام‌ها و وظایف اصلی',
        '🎯 ۹۰ دقیقه کار متمرکز و بدون حواس‌پرتی (دیپ ورک)',
        '🚶‍♂️ ۱۵ دقیقه کشش، اصلاح وضعیت نشستن و استراحت',
        '💧 نوشیدن منظم آب در طول ساعات کاری',
        '📋 جمع‌بندی گزارش کار و لیست کارهای فردا'
      ]
    },
    {
      id: 'freelancer_gamer',
      title: isEn ? 'Freelancer & Gamer' : 'برنامه فریلنسر / گیمر',
      subtitle: isEn ? 'Energy management, eye rest & projects' : 'مدیریت انرژی، استراحت چشم و پیشرفت پروژه',
      icon: Laptop,
      color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-400',
      btnColor: 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20',
      routines: isEn ? [
        '💧 Hydrate, wash face & 10-min sunlight exposure',
        '💻 Core project development & client tasks',
        '👀 20-20-20 Eye break and wrist stretching',
        '🎯 Skill practice, stream setup or creative sprint',
        '🏃‍♂️ 20-min Physical workout / walk outside',
        '📵 No screen time 30 mins before sleep'
      ] : [
        '💧 نوشیدن آب، شستشوی صورت و ۱۰ دقیقه نور آفتاب',
        '💻 کار بر روی پروژه‌های اصلی، کدنویسی یا طراحی',
        '👀 استراحت چشم (قانون ۲۰-۲۰-۲۰) و کشش مچ دست',
        '🎯 تمرین مهارت جدید، تولید محتوا یا استریم',
        '🏃‍♂️ ۲۰ دقیقه فعالیت بدنی، ورزش یا پیاده‌روی',
        '📵 قطع کامل کار با مانیتور و گوشی ۳۰ دقیقه قبل خواب'
      ]
    }
  ];

  const handleApplyOfflinePackage = (packageRoutines: string[]) => {
    const uniqueNew = packageRoutines.filter(txt => !fixedDaily.includes(txt));
    const finalList = uniqueNew.length > 0 ? [...fixedDaily, ...uniqueNew] : [...fixedDaily, ...packageRoutines];
    onUpdateFixedDaily(finalList);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex flex-col gap-6 max-w-6xl mx-auto pb-12" 
      id="week-panel-container"
      dir="rtl"
    >
      {/* 2. Fixed Daily Routines Manager (برنامه ثابت روزانه - آکاردئون قابل بستن/باز شدن) */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/30 bg-[var(--card-bg)] backdrop-blur-2xl p-4 sm:p-5 shadow-lg shadow-violet-500/5 transition-all">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-violet-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        {/* Section Header / Toggle Bar */}
        <div 
          onClick={() => setIsFixedRoutinesOpen(!isFixedRoutinesOpen)}
          className="flex items-center justify-between flex-wrap gap-3 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Sun className="w-5 h-5 text-violet-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-[var(--text)] tracking-tight">
                  {isEn ? 'Daily Fixed Routines & Schedule' : 'روال‌ها و برنامه‌های ثابت هر روز'}
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-500 dark:text-violet-400 font-extrabold border border-violet-500/30">
                  {isEn ? `${fixedDaily.length} active routines` : `${fixedDaily.length} روال فعال`}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text3)] mt-0.5">
                {isEn ? 'These habits & tasks repeat every day (Sat to Fri)' : 'این عادات و برنامه‌ها هر روز (شنبه تا جمعه) به‌طور تکرارپذیر اجرا می‌شوند'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenAiModal();
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/25 border border-violet-400/30"
              title={isEn ? "Generate Routines with AI" : "ساخت برنامه با هوش مصنوعی"}
            >
              <Bot className="w-4 h-4 text-violet-200 animate-pulse" />
              <span>{isEn ? 'Build with AI' : 'ساخت برنامه با هوش مصنوعی'}</span>
              <Sparkles className="w-3 h-3 text-amber-300" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFixedRoutinesOpen(!isFixedRoutinesOpen);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                isFixedRoutinesOpen
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                  : 'bg-[var(--sidebar-hover)] border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] hover:border-violet-500/30'
              }`}
            >
              <span>{isFixedRoutinesOpen ? (isEn ? 'Collapse Routines' : 'بستن روال‌ها') : (isEn ? 'Manage & Add Routines' : 'مشاهده و مدیریت روال‌ها')}</span>
              {isFixedRoutinesOpen ? (
                <ChevronUp className="w-4 h-4 text-violet-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-violet-400" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        <AnimatePresence>
          {isFixedRoutinesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden space-y-4 pt-4 border-t border-violet-500/15 mt-4"
            >
              {/* Quick Add Bar & Presets */}
              <div className="space-y-3">
                {/* Main Input Field */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Sun className="w-4 h-4 absolute right-3.5 top-3 text-violet-400 pointer-events-none" />
                    <input
                      type="text"
                      value={newFixedTask}
                      onChange={(e) => setNewFixedTask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addFixedItem(newFixedTask)}
                      placeholder={isEn ? "Add new fixed routine (e.g., 30min morning exercise, book reading...)" : "افزودن روال ثابت جدید (مثلاً: ۳۰ دقیقه ورزش صبحگاهی، مطالعه کتاب...)"}
                      className="w-full rounded-2xl pr-10 pl-4 py-2.5 text-xs border border-violet-500/20 bg-[var(--input-bg)] text-[var(--text)] placeholder:[var(--text3)] outline-none transition-all focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/15"
                    />
                  </div>
                  <button
                    onClick={() => addFixedItem(newFixedTask)}
                    className="px-4 py-2.5 rounded-2xl text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-700 hover:to-indigo-700 shadow-sm shadow-violet-500/20 active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isEn ? 'Add Routine' : 'افزودن روال'}</span>
                  </button>
                </div>

                {/* 3 Complete Offline Routine Packages Cards (Always available, no AI/internet needed) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--text2)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isEn ? 'Complete Default Packages (Offline & Instant):' : 'بسته‌های پیشنهادی کامل (آفلاین و سریع):'}</span>
                    </span>
                    <span className="text-[10px] text-[var(--text3)]">
                      {isEn ? 'Click to add all routines instantly' : 'کلیک روی هر بسته برای افزودن یک‌جای همه روال‌ها'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {defaultOfflinePackages.map((pkg) => {
                      const IconComp = pkg.icon;
                      const allAlreadyAdded = pkg.routines.every(r => fixedDaily.includes(r));
                      const addedCount = pkg.routines.filter(r => fixedDaily.includes(r)).length;

                      return (
                        <div
                          key={pkg.id}
                          className={`relative p-3.5 rounded-2xl border bg-gradient-to-b ${pkg.color} flex flex-col justify-between gap-3 transition-all duration-200 hover:shadow-md`}
                        >
                          <div className="space-y-2">
                            {/* Card Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-xl bg-white/10 dark:bg-black/20 shrink-0">
                                  <IconComp className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-[var(--text)] leading-snug">
                                    {pkg.title}
                                  </h4>
                                </div>
                              </div>

                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/15 dark:bg-black/25 text-[var(--text)] shrink-0 font-bold">
                                {pkg.routines.length} {isEn ? 'items' : 'روال'}
                              </span>
                            </div>

                            <p className="text-[10.5px] text-[var(--text3)] leading-relaxed">
                              {pkg.subtitle}
                            </p>

                            {/* Mini Preview of routines */}
                            <div className="space-y-1 pt-1">
                              {pkg.routines.slice(0, 3).map((r, rIdx) => (
                                <div key={rIdx} className="text-[10.5px] text-[var(--text2)] truncate flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-60" />
                                  <span className="truncate">{r}</span>
                                </div>
                              ))}
                              {pkg.routines.length > 3 && (
                                <div className="text-[10px] text-[var(--text3)] font-medium">
                                  + {pkg.routines.length - 3} {isEn ? 'more habits' : 'روال دیگر...'}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            type="button"
                            onClick={() => handleApplyOfflinePackage(pkg.routines)}
                            disabled={allAlreadyAdded}
                            className={`w-full py-2 px-3 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 ${
                              allAlreadyAdded
                                ? 'bg-slate-500/20 text-slate-400 border border-slate-500/20 cursor-not-allowed opacity-75'
                                : `${pkg.btnColor}`
                            }`}
                          >
                            {allAlreadyAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{isEn ? 'Added to Routines' : 'اضافه شده به برنامه'}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>
                                  {addedCount > 0 
                                    ? (isEn ? `Add Remaining (${pkg.routines.length - addedCount})` : `افزودن باقی‌مانده‌ها (${pkg.routines.length - addedCount})`)
                                    : (isEn ? 'Apply This Package' : 'اعمال این برنامه')}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Display Routines in Sleek Cards Grid */}
              <div className="pt-2">
                {fixedDaily.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 space-y-2">
                    <Sun className="w-8 h-8 text-violet-400 mx-auto opacity-70 animate-pulse" />
                    <p className="text-xs font-bold text-[var(--text)]">{isEn ? 'No fixed routines added yet.' : 'هنوز هیچ روال ثابتی برای روزها اضافه نکرده‌اید.'}</p>
                    <p className="text-[11px] text-[var(--text3)]">{isEn ? 'Add a repeatable daily task from the input above or quick suggestions.' : 'از کادر بالا یا پیشنهادهای سریع یک کار تکرارپذیر روزانه مثل ورزش یا مطالعه اضافه کنید.'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                    {fixedDaily.map((item, idx) => (
                      <div
                        key={idx}
                        className="group relative flex flex-col justify-between p-3.5 rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--sidebar-hover)] to-[var(--card-bg)] hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                      >
                        {/* Top subtle hover accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        {editingFixedIdx === idx ? (
                          <div className="flex items-center gap-1.5 w-full my-1">
                            <input
                              type="text"
                              value={editingFixedText}
                              onChange={(e) => setEditingFixedText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditFixed(idx);
                                if (e.key === 'Escape') cancelEditFixed();
                              }}
                              autoFocus
                              className="flex-1 rounded-xl px-2.5 py-1.5 text-xs border border-violet-500 bg-[var(--card-bg)] text-[var(--text)] outline-none shadow-inner"
                            />
                            <button
                              onClick={() => saveEditFixed(idx)}
                              className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 cursor-pointer transition-colors"
                              title={isEn ? "Save" : "ذخیره"}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEditFixed}
                              className="p-2 rounded-xl bg-slate-500/20 text-slate-300 hover:bg-slate-500/30 cursor-pointer transition-colors"
                              title={isEn ? "Cancel" : "انصراف"}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Top Header Row: Index Badge & Routine Tag & Action Controls */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="w-6 h-6 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 text-violet-400 font-extrabold text-[10px] flex items-center justify-center shrink-0 dir-ltr shadow-2xs">
                                  #{idx + 1}
                                </span>
                                <span className="text-[10px] font-semibold text-violet-400/80 bg-violet-500/10 px-2 py-0.5 rounded-lg border border-violet-500/15 flex items-center gap-1">
                                  <Zap className="w-2.5 h-2.5 text-violet-400" />
                                  {isEn ? 'Daily Routine' : 'روال روزانه'}
                                </span>
                              </div>

                              {/* Control Actions */}
                              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                                {/* Horizontal Reorder Arrows */}
                                <div className="flex items-center gap-0.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl p-0.5 shadow-2xs">
                                  <button
                                    onClick={() => moveFixedItem(idx, -1)}
                                    disabled={idx === 0}
                                    className="p-1 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/15 disabled:opacity-20 cursor-pointer transition-colors"
                                    title={isEn ? "Move Right" : "انتقال به قبل (جایگاه قبلی)"}
                                  >
                                    <MoveRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => moveFixedItem(idx, 1)}
                                    disabled={idx === fixedDaily.length - 1}
                                    className="p-1 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/15 disabled:opacity-20 cursor-pointer transition-colors"
                                    title={isEn ? "Move Left" : "انتقال به بعد (جایگاه بعدی)"}
                                  >
                                    <MoveLeft className="w-3 h-3" />
                                  </button>
                                </div>

                                <button
                                  onClick={() => startEditFixed(idx)}
                                  className="p-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-slate-400 hover:text-violet-400 hover:bg-violet-500/15 hover:border-violet-500/30 cursor-pointer transition-colors"
                                  title={isEn ? "Edit Routine" : "ویرایش روال"}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => deleteFixedItem(idx)}
                                  className="p-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-slate-400 hover:text-red-400 hover:bg-red-500/15 hover:border-red-500/30 cursor-pointer transition-colors"
                                  title={isEn ? "Delete Routine" : "حذف این روال"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Routine Content Text */}
                            <div className="pt-1 pb-0.5">
                              <p className="text-xs font-bold text-[var(--text)] leading-relaxed break-words">
                                {item}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Days Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {weekDaysInfo.map((day) => {
          const { dayName, key, extras, isToday, shamsiDate, shamsiMonth } = day;

          const completedCount = extras.filter(e => e.done).length;
          const dayProgressPercent = extras.length > 0 ? Math.round((completedCount / extras.length) * 100) : 0;

          return (
            <div
              key={key}
              className={`rounded-3xl border overflow-hidden transition-all duration-300 bg-[var(--card-bg)] flex flex-col justify-between ${
                isToday 
                  ? 'border-violet-500/70 ring-2 ring-violet-500/30 shadow-xl shadow-violet-500/10 relative' 
                  : 'border-[var(--border)] shadow-xs hover:border-[var(--border-hover)]'
              }`}
            >
              <div>
                {/* Day Header Bar */}
                <div
                  className={`w-full flex items-center justify-between p-4 transition-colors ${
                    isToday
                      ? 'bg-gradient-to-r from-violet-500/20 via-indigo-500/10 to-transparent'
                      : 'bg-[var(--card-bg)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shadow-xs ${
                      isToday
                        ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-violet-500/30 ring-2 ring-violet-400/30'
                        : 'bg-[var(--sidebar-hover)] text-[var(--text)] border border-[var(--border)]'
                    }`}>
                      {dayName.slice(0, 1)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black ${isToday ? 'text-violet-500 dark:text-violet-400' : 'text-[var(--text)]'}`}>
                          {dayName}
                        </span>
                        {isToday && (
                          <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-black shadow-xs flex items-center gap-1">
                            <Zap className="w-3 h-3 fill-current text-violet-200 animate-pulse" />
                            <span>{isEn ? 'Today' : 'امروز'}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--text3)] font-medium block mt-0.5">
                        {isEn ? day.dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `${shamsiDate} ${shamsiMonth}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Task count pill */}
                    <span className={`text-[11px] px-2.5 py-1 rounded-xl font-bold border ${
                      extras.length > 0 && completedCount === extras.length
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-[var(--sidebar-hover)] border-[var(--border)] text-[var(--text2)]'
                    }`}>
                      {isEn ? `${completedCount} of ${extras.length}` : `${completedCount} از ${extras.length}`}
                    </span>
                  </div>
                </div>

                {/* Day Progress Line */}
                {extras.length > 0 && (
                  <div className="h-1 w-full bg-[var(--sidebar-hover)]">
                    <div 
                      className="h-full bg-emerald-400 transition-all duration-300" 
                      style={{ width: `${dayProgressPercent}%` }} 
                    />
                  </div>
                )}

                {/* Day Body Content */}
                <div className="p-3.5 sm:p-4 space-y-3 border-t border-[var(--border)] bg-[var(--sidebar-hover)]/30">
                  
                  {/* Unified Pills Area: Fixed daily routines (violet) + Custom tasks (amber/emerald reorderable) in a continuous flow */}
                  {(fixedDaily.length > 0 || extras.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* 1. Fixed Daily Routine Pills (Violet) */}
                      {fixedDaily.map((item, idx) => (
                        <span 
                          key={`fixed-${idx}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-violet-500/10 dark:bg-violet-500/15 text-[var(--text)] border border-violet-500/20 shadow-xs hover:border-violet-500/40 hover:bg-violet-500/20 hover:scale-[1.02] transition-all duration-200 cursor-default select-none shrink-0"
                        >
                          <CheckCircle2 className="w-3 h-3 text-violet-500 dark:text-violet-400 shrink-0" />
                          <span>{item}</span>
                        </span>
                      ))}

                      {/* 2. Custom Task Pills (Amber/Emerald, Reorder via Arrow Buttons) */}
                      {extras.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {extras.map((extra, originalIdx) => (
                            <div
                              key={extra.id}
                              className={`group relative inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition-all duration-200 select-none ${
                                extra.done
                                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25 text-[var(--text3)] line-through'
                                  : 'bg-amber-500/10 dark:bg-amber-500/15 text-[var(--text)] border-amber-500/20 shadow-xs hover:border-amber-500/40 hover:bg-amber-500/20'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); moveExtraItem(key, originalIdx, -1); }}
                                disabled={originalIdx === 0}
                                className="opacity-0 group-hover:opacity-100 disabled:opacity-0 p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer"
                                title={isEn ? "Move right" : "جابه‌جایی به راست"}
                              >
                                <MoveRight className="w-3 h-3" />
                              </button>

                              <span onClick={() => onToggleExtra(key, originalIdx)} className="cursor-pointer flex items-center gap-1.5">
                                {extra.done ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
                                ) : (
                                  <Circle className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0 opacity-80 group-hover:opacity-100" />
                                )}
                                <span className={`truncate max-w-[140px] inline-block align-bottom ${extra.done ? 'opacity-70' : ''}`} title={extra.text}>{extra.text}</span>
                              </span>

                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); moveExtraItem(key, originalIdx, 1); }}
                                disabled={originalIdx === extras.length - 1}
                                className="opacity-0 group-hover:opacity-100 disabled:opacity-0 p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer"
                                title={isEn ? "Move left" : "جابه‌جایی به چپ"}
                              >
                                <MoveLeft className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDeleteExtra(key, originalIdx); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-500/20 text-[var(--text3)] hover:text-red-400 transition-all shrink-0 cursor-pointer"
                                title={isEn ? "Delete task" : "حذف این کار"}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {fixedDaily.length === 0 && extras.length === 0 && (
                    <div className="text-[11px] text-[var(--text3)] py-1.5 text-center">
                      {isEn ? 'No tasks scheduled' : 'هنوز کاری ثبت نشده'}
                    </div>
                  )}

                  {/* Quick Add Custom Task Field */}
                  <div className="flex gap-1.5 pt-0.5">
                    <input
                      type="text"
                      value={extraInputs[key] || ''}
                      onChange={(e) => setExtraInputs({ ...extraInputs, [key]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addExtra(key)}
                      placeholder={isEn ? `+ Add custom task for ${dayName}...` : `+ افزودن کار اختصاصی برای ${dayName}...`}
                      className="flex-1 rounded-xl px-3 py-1.5 text-xs border border-[var(--input-border)] bg-[var(--card-bg)] outline-none transition-all text-[var(--text)] placeholder:[var(--text3)] focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => addExtra(key)}
                      className="px-3 py-1.5 rounded-xl text-white font-bold text-xs flex items-center justify-center transition-all cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm active:scale-95 shrink-0"
                      title={isEn ? "Add" : "افزودن"}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Routine Builder Assistant Modal */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir={isEn ? 'ltr' : 'rtl'}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseAiModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-violet-500/30 bg-[var(--card-bg)] shadow-2xl shadow-violet-900/20 overflow-hidden z-10"
            >
              {/* Modal Header */}
              <div className="relative p-5 sm:p-6 border-b border-[var(--border)] bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 shrink-0">
                    <Bot className="w-6 h-6 text-violet-100" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-[var(--text)]">
                        {isEn ? 'AI Daily Routine Assistant' : 'دستیار هوشمند ساخت روال‌های ثابت روزانه'}
                      </h3>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        AI
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text3)] mt-0.5">
                      {isEn 
                        ? 'Answer a few quick questions to generate personalized daily habits & routines' 
                        : 'با پاسخ به چند سوال کوتاه، بهترین روال‌ها و عادات روزانه را متناسب با زندگی‌تان دریافت کنید'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseAiModal}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                {/* Error Banner */}
                {aiError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-xs text-rose-500 dark:text-rose-400"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{aiError}</span>
                    <button
                      type="button"
                      onClick={handleGenerateAiSuggestions}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-bold transition-colors cursor-pointer"
                    >
                      {isEn ? 'Retry' : 'تلاش مجدد'}
                    </button>
                  </motion.div>
                )}

                {/* State A: Questionnaire Form */}
                {!hasGenerated ? (
                  <div className="space-y-5">
                    {/* 1. Lifestyle / Role Selection */}
                    <div className="space-y-2.5">
                      <label className="text-xs font-bold text-[var(--text)] flex items-center gap-2">
                        <User className="w-4 h-4 text-violet-400" />
                        <span>{isEn ? 'Your Role / Lifestyle:' : 'نقش یا سبک زندگی شما:'}</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {roleOptions.map((role) => {
                          const isSelected = aiRole === role;
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => setAiRole(role)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/25 scale-[1.02]'
                                  : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text2)] hover:border-violet-500/40 hover:text-[var(--text)]'
                              }`}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Role Input if 'Other' selected */}
                      {(aiRole === 'دیگر' || aiRole === 'Other') && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-1"
                        >
                          <input
                            type="text"
                            value={customAiRole}
                            onChange={(e) => setCustomAiRole(e.target.value)}
                            placeholder={isEn ? 'Enter your role or lifestyle...' : 'نقش یا زمینه فعالیت خود را بنویسید (مثلاً: طراح گرافیک، کنکوری...)'}
                            className="w-full rounded-xl px-3.5 py-2 text-xs border border-[var(--input-border)] bg-[var(--card-bg)] outline-none text-[var(--text)] placeholder:[var(--text3)] focus:border-violet-500/60"
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* 2. Sleep & Wake Schedule with Preset Buttons */}
                    <div className="space-y-4">
                      <label className="text-xs font-bold text-[var(--text)] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-violet-400" />
                        <span>{isEn ? 'Typical Wake & Sleep Times:' : 'ساعت تقریبی بیداری و خواب:'}</span>
                      </label>

                      {/* Wake Up Time Presets */}
                      <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--sidebar-hover)]/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                            <Sun className="w-3.5 h-3.5 text-amber-400" />
                            <span>{isEn ? 'Wake Up Time:' : 'ساعت بیدار شدن:'}</span>
                          </span>
                          <span className="text-xs font-mono font-black text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-lg border border-violet-500/20">
                            {aiWakeTime}
                          </span>
                        </div>

                        {/* Wake Presets Grid */}
                        <div className="flex flex-wrap gap-1.5">
                          {['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '09:00'].map((time) => {
                            const isSelected = !isCustomWakeTime && aiWakeTime === time;
                            return (
                              <button
                                key={time}
                                type="button"
                                onClick={() => {
                                  setAiWakeTime(time);
                                  setIsCustomWakeTime(false);
                                }}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/25 scale-[1.02]'
                                    : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text2)] hover:border-violet-500/40 hover:text-[var(--text)]'
                                }`}
                              >
                                {time}
                              </button>
                            );
                          })}

                          {/* Custom Wake Time Toggle Button */}
                          <button
                            type="button"
                            onClick={() => setIsCustomWakeTime(!isCustomWakeTime)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                              isCustomWakeTime
                                ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/25'
                                : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text2)] hover:border-violet-500/40 hover:text-[var(--text)]'
                            }`}
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Custom' : 'ساعت دلخواه'}</span>
                          </button>
                        </div>

                        {/* Custom Wake Time Input Row */}
                        {isCustomWakeTime && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="pt-2 flex items-center gap-2 border-t border-[var(--border)]/60"
                          >
                            <span className="text-[11px] text-[var(--text3)]">{isEn ? 'Choose exact wake time:' : 'انتخاب ساعت دقیق بیداری:'}</span>
                            <TimePicker
                              value={aiWakeTime}
                              onChange={setAiWakeTime}
                              isEn={isEn}
                            />
                          </motion.div>
                        )}
                      </div>

                      {/* Sleep Time Presets */}
                      <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--sidebar-hover)]/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{isEn ? 'Sleep Time:' : 'ساعت خوابیدن:'}</span>
                          </span>
                          <span className="text-xs font-mono font-black text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-lg border border-violet-500/20">
                            {aiSleepTime}
                          </span>
                        </div>

                        {/* Sleep Presets Grid */}
                        <div className="flex flex-wrap gap-1.5">
                          {['21:30', '22:00', '22:30', '23:00', '23:30', '00:00', '00:30'].map((time) => {
                            const isSelected = !isCustomSleepTime && aiSleepTime === time;
                            return (
                              <button
                                key={time}
                                type="button"
                                onClick={() => {
                                  setAiSleepTime(time);
                                  setIsCustomSleepTime(false);
                                }}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/25 scale-[1.02]'
                                    : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text2)] hover:border-violet-500/40 hover:text-[var(--text)]'
                                }`}
                              >
                                {time}
                              </button>
                            );
                          })}

                          {/* Custom Sleep Time Toggle Button */}
                          <button
                            type="button"
                            onClick={() => setIsCustomSleepTime(!isCustomSleepTime)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                              isCustomSleepTime
                                ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/25'
                                : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text2)] hover:border-violet-500/40 hover:text-[var(--text)]'
                            }`}
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Custom' : 'ساعت دلخواه'}</span>
                          </button>
                        </div>

                        {/* Custom Sleep Time Input Row */}
                        {isCustomSleepTime && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="pt-2 flex items-center gap-2 border-t border-[var(--border)]/60"
                          >
                            <span className="text-[11px] text-[var(--text3)]">{isEn ? 'Choose exact sleep time:' : 'انتخاب ساعت دقیق خواب:'}</span>
                            <TimePicker
                              value={aiSleepTime}
                              onChange={setAiSleepTime}
                              isEn={isEn}
                            />
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* 3. Goals & Priorities (Optional) */}
                    <div className="space-y-2.5">
                      <label className="text-xs font-bold text-[var(--text)] flex items-center gap-2">
                        <Target className="w-4 h-4 text-violet-400" />
                        <span>{isEn ? 'Priorities & Special Goals (Optional):' : 'اولویت‌ها، علایق یا اهداف ویژه (اختیاری):'}</span>
                      </label>
                      <textarea
                        rows={2}
                        value={aiPriorities}
                        onChange={(e) => setAiPriorities(e.target.value)}
                        placeholder={isEn 
                          ? 'e.g. Daily morning workout, learning English, reading 20 pages, minimizing screen time...'
                          : 'مثلاً: ورزش صبحگاهی، تمرکز روی یادگیری زبان انگلیسی، مطالعه کتاب، کاهش استفاده از گوشی...'}
                        className="w-full rounded-2xl p-3 text-xs border border-[var(--input-border)] bg-[var(--card-bg)] outline-none text-[var(--text)] placeholder:[var(--text3)] focus:border-violet-500/60 resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  /* State B: Suggestions Review & Customization */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-black text-[var(--text)]">
                          {isEn ? `${aiSuggestions.length} Routines Suggested:` : `${aiSuggestions.length} روال روزانه پیشنهاد شد:`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleSelectAllSuggestions}
                        className="text-xs font-bold text-violet-500 dark:text-violet-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>
                          {aiSuggestions.every(item => item.checked)
                            ? (isEn ? 'Deselect All' : 'لغو انتخاب همه')
                            : (isEn ? 'Select All' : 'انتخاب همه')}
                        </span>
                      </button>
                    </div>

                    {/* Suggestions List */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                      {aiSuggestions.map((item) => {
                        const isEditing = editingSuggestionId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                              item.checked
                                ? 'bg-violet-500/10 border-violet-500/30'
                                : 'bg-[var(--sidebar-hover)]/30 border-[var(--border)] opacity-60'
                            }`}
                          >
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => handleToggleSuggestion(item.id)}
                              className="text-violet-500 shrink-0 cursor-pointer"
                            >
                              {item.checked ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4 text-[var(--text3)]" />
                              )}
                            </button>

                            {/* Content or Edit Input */}
                            {isEditing ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingSuggestionText}
                                  onChange={(e) => setEditingSuggestionText(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEditSuggestion(item.id)}
                                  className="flex-1 rounded-xl px-3 py-1 text-xs border border-violet-500 bg-[var(--card-bg)] text-[var(--text)] outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditSuggestion(item.id)}
                                  className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                                  title={isEn ? "Save" : "ذخیره"}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSuggestionId(null)}
                                  className="p-1.5 rounded-lg bg-[var(--sidebar-hover)] text-[var(--text2)] hover:text-[var(--text)] transition-colors cursor-pointer"
                                  title={isEn ? "Cancel" : "انصراف"}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span
                                onClick={() => handleToggleSuggestion(item.id)}
                                className={`flex-1 text-xs font-bold select-none cursor-pointer transition-colors ${
                                  item.checked ? 'text-[var(--text)]' : 'text-[var(--text3)] line-through'
                                }`}
                              >
                                {item.text}
                              </span>
                            )}

                            {/* Action Buttons */}
                            {!isEditing && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditSuggestion(item.id, item.text)}
                                  className="p-1.5 rounded-lg text-[var(--text3)] hover:text-violet-400 hover:bg-violet-500/10 transition-colors cursor-pointer"
                                  title={isEn ? "Edit" : "ویرایش"}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSuggestionItem(item.id)}
                                  className="p-1.5 rounded-lg text-[var(--text3)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title={isEn ? "Delete" : "حذف"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Add Extra Suggestion */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newCustomSuggestionText}
                        onChange={(e) => setNewCustomSuggestionText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSuggestionItem()}
                        placeholder={isEn ? '+ Add another routine to the list...' : '+ افزودن یک روال دلخواه دیگر به لیست...'}
                        className="flex-1 rounded-xl px-3.5 py-2 text-xs border border-[var(--input-border)] bg-[var(--card-bg)] outline-none text-[var(--text)] placeholder:[var(--text3)] focus:border-violet-500/60"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSuggestionItem}
                        className="px-3.5 py-2 rounded-xl bg-[var(--sidebar-hover)] hover:bg-violet-500/20 text-[var(--text)] font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-[var(--border)]"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 sm:p-6 border-t border-[var(--border)] bg-[var(--sidebar-hover)]/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                {!hasGenerated ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCloseAiModal}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition-all cursor-pointer"
                    >
                      {isEn ? 'Cancel' : 'انصراف'}
                    </button>

                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={handleGenerateAiSuggestions}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-600/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>{isEn ? 'Analyzing & Generating...' : 'در حال تحلیل و تولید برنامه...'}</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-4 h-4 text-violet-200" />
                          <span>{isEn ? 'Generate Suggestions with AI' : 'ساخت پیشنهاد با هوش مصنوعی'}</span>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setHasGenerated(false)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-violet-400" />
                      <span>{isEn ? 'Back & Change Info' : 'تغییر اطلاعات و سوالات'}</span>
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleCloseAiModal}
                        className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text2)] hover:text-[var(--text)] transition-all cursor-pointer"
                      >
                        {isEn ? 'Close' : 'بستن'}
                      </button>

                      <button
                        type="button"
                        onClick={handleApplySelectedSuggestions}
                        disabled={aiSuggestions.filter(item => item.checked).length === 0}
                        className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {isEn 
                            ? `Add ${aiSuggestions.filter(item => item.checked).length} Selected to Routines` 
                            : `افزودن ${aiSuggestions.filter(item => item.checked).length} مورد انتخاب‌شده به روال‌ها`}
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
