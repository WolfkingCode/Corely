/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getTranslation } from './lib/i18n';

// Custom Hooks
import { useSettings } from './hooks/useSettings';
import { useSoundFeedback } from './hooks/useSoundFeedback';
import { useThemeAndBackground } from './hooks/useThemeAndBackground';
import { useNavigation } from './hooks/useNavigation';
import { useAppData } from './hooks/useAppData';
import { useAiChat } from './hooks/useAiChat';

// Synchronously loaded core components for instant initial paint
import TitleBar from './components/TitleBar';
import HomePanel from './components/HomePanel';
import SplashScreen from './components/SplashScreen';
import Sidebar from './components/Sidebar';
import LightboxModal from './components/LightboxModal';
import GlobalSearch from './components/GlobalSearch';
import MobileBottomNav from './components/MobileBottomNav';
import PanelLoadingFallback from './components/PanelLoadingFallback';
import { CursorGlow } from './components/CursorGlow';
import { isDesktopApp } from './lib/notifications';

// Lazy-loaded heavy sub-panels with preloader capability
import {
  AiPanel,
  NotePanel,
  IdeasPanel,
  EditAssetsPanel,
  RoutinePanel,
  FinancePanel,
  DownloadManagerPanel,
  DnsChangerPanel,
  SettingsPanel,
  preloadAllPanelsIdle,
  preloadPanel
} from './lib/lazyPanels';

export default function App() {
  // 1. Settings & Audio feedback
  const { settings, handleSettingsChange } = useSettings();
  const { playActionSound } = useSoundFeedback(settings.soundEnabled);

  // 2. Theme Management
  const {
    activeTheme,
    setActiveTheme,
    currentThemeObj
  } = useThemeAndBackground();

  // 3. Navigation & Sidebar
  const {
    activePanel,
    handlePanelSwitch,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    panelNavCount,
    routineSubView,
    settingsTab
  } = useNavigation();

  // 4. Core App Data & CRUD Operations
  const {
    ideas,
    todos,
    shopping,
    finance,
    note,
    fixedDaily,
    weekExtras,
    lastActivity,
    todayKey,
    todayExtras,
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
    savingsGoals,
    handleAddSavingsGoal,
    handleAddToSavingsGoal,
    handleDeleteSavingsGoal,
    handleToggleGoalPin
  } = useAppData({ onPlaySound: playActionSound });

  // 5. AI Chat & Multi-session Memory
  const handleAppendNote = useCallback((textToAppend: string) => {
    handleNoteChange(note ? `${note}\n${textToAppend}` : textToAppend);
  }, [note, handleNoteChange]);

  const {
    chatThreads,
    activeThreadId,
    activeMessages,
    isAiLoading,
    selectedAiModel,
    handleSelectThread,
    handleNewThread,
    handleDeleteThread,
    handleRenameThread,
    handleClearAiHistory,
    handleSelectModel,
    handleAskAi: triggerAskAi
  } = useAiChat({
    onAddTask: handleAddTask,
    onAddWeeklyTask: handleAddExtra,
    onAddTransaction: handleAddTransaction,
    onAppendNote: handleAppendNote
  });

  // 6. Lightbox & Splash UI states
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isLanguageSwitching, setIsLanguageSwitching] = useState<boolean>(false);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxSrc, setLightboxSrc] = useState<string>('');

  // 7. Global search (button in the sidebar footer or Ctrl+K)
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activePanel, panelNavCount]);

  // Wrapped settings change handler to trigger smooth splash on language switch
  const onSettingsUpdate = useCallback((newSettings: typeof settings) => {
    if (newSettings.language !== settings.language) {
      setIsLanguageSwitching(true);
      handleSettingsChange(newSettings);
      setTimeout(() => {
        setIsLanguageSwitching(false);
      }, 700);
    } else {
      handleSettingsChange(newSettings);
    }
  }, [settings.language, handleSettingsChange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Background Idle Preloader: Preload lazy panels during idle periods
  useEffect(() => {
    const cancelPreload = preloadAllPanelsIdle(1200);
    return () => cancelPreload();
  }, []);

  // Sync root document direction and lang with user selected language
  useEffect(() => {
    const isEn = settings.language === 'en';
    document.documentElement.dir = isEn ? 'ltr' : 'rtl';
    document.documentElement.lang = isEn ? 'en' : 'fa';
  }, [settings.language]);

  // Context builder for AI Assistant queries
  const getAiContextData = useCallback(() => {
    const totalIncome = monthlyTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = monthlyTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      userName: settings?.userName || 'کاربر',
      todaySchedule: {
        routine: fixedDaily,
        tasks: todayExtras
      },
      todosCount: todos.length,
      pendingTodos: todos.filter((t) => !t.done).map((t) => t.text),
      shoppingPending: shopping.filter((s) => !s.done).map((s) => s.text),
      financialSummary: {
        income: totalIncome,
        expense: totalExpense,
        balance: totalIncome - totalExpense
      },
      ideas: ideas.map((i) => ({ title: i.title, desc: i.desc })),
      noteSnippet: note ? note.slice(0, 300) : ''
    };
  }, [monthlyTransactions, settings, fixedDaily, todayExtras, todos, shopping, ideas, note]);

  const handleAskAi = useCallback((promptText: string) => {
    triggerAskAi(promptText, getAiContextData, () => handlePanelSwitch('ai'));
  }, [triggerAskAi, getAiContextData, handlePanelSwitch]);

  // Active panel titles
  const t = getTranslation(settings.language);
  const panelTitles: Record<string, string> = {
    home: t.home,
    ai: t.ai,
    note: t.note,
    ideas: t.ideas,
    idea: t.ideas,
    edit_assets: t.edit_assets,
    routine: t.routine,
    week: t.routine,
    tasks: t.tasks,
    task: t.tasks,
    shopping: t.tasks,
    habits: t.habits,
    finance: t.finance,
    downloads: t.downloads,
    settings: t.settings,
    appearance: settings.language === 'en' ? 'Appearance' : 'شخصی‌سازی'
  };

  // Is desktop shell
  const isDesktop = isDesktopApp();

  return (
    <div 
      className={`relative min-h-screen font-sans antialiased text-start ${settings.language === 'en' ? 'ltr' : 'rtl'} overflow-hidden`} 
      dir={settings.language === 'en' ? 'ltr' : 'rtl'}
    >
      {/* Custom Title Bar for Desktop App */}
      <TitleBar />

      {/* Splash Screen Animation */}
      <AnimatePresence>
        {(showSplash || isLanguageSwitching) && (
          <SplashScreen key={isLanguageSwitching ? "splash-lang" : "splash-init"} settings={settings} />
        )}
      </AnimatePresence>

      {/* Background layer directly driven by active theme */}
      <div 
        className={`fixed inset-0 z-0 bg-gradient-to-br ${currentThemeObj.bg} transition-all duration-500 ease-out`}
      />

      {/* Main app shell */}
      <div className={`app relative z-10 grid grid-cols-1 ${isSidebarCollapsed ? 'md:grid-cols-[56px_1fr]' : 'md:grid-cols-[256px_1fr]'} ${isDesktop ? 'h-[calc(100vh-36px)]' : 'h-screen'} overflow-hidden transition-[grid-template-columns] duration-300 ease-in-out`}>
        {/* Sidebar */}
        <Sidebar 
          activePanel={activePanel}
          onPanelChange={handlePanelSwitch}
          theme={currentThemeObj}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          settings={settings}
          onPreloadPanel={preloadPanel}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {/* Main Content Area */}
        <main ref={mainContentRef} className={`main relative flex flex-col overflow-hidden ${isDesktop ? 'h-[calc(100vh-36px)]' : 'h-screen'} bg-transparent`}>
          {/* Ambient Cursor Glow behind cards, strictly confined to main panel */}
          <CursorGlow containerRef={mainContentRef} />

          {/* Topbar (Shown on sub-panels seamlessly without black top bar or border line) */}
          <AnimatePresence mode="wait">
            {activePanel !== 'home' && (
              <motion.header
                key="topbar"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="topbar relative z-10 flex items-center justify-between px-6 py-3.5 shrink-0 bg-transparent border-none overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-base font-semibold ${currentThemeObj.textPrimary}`}>
                    {activePanel === 'routine'
                      ? (routineSubView === 'tasks'
                          ? (settings.language === 'en' ? 'Tasks' : 'کارها')
                          : routineSubView === 'shopping'
                          ? (settings.language === 'en' ? 'Shopping List' : 'لیست خرید')
                          : routineSubView === 'habits'
                          ? t.habits
                          : routineSubView === 'week'
                          ? (settings.language === 'en' ? 'Weekly Plan' : 'برنامه هفتگی')
                          : t.routine)
                      : panelTitles[activePanel]}
                  </span>
                </div>
              </motion.header>
            )}
          </AnimatePresence>

          {/* Sub-panels container */}
          <div ref={contentRef} className={`content relative z-10 flex-1 p-4 md:p-6 overflow-x-hidden ${activePanel === 'ai' ? 'overflow-hidden flex flex-col space-y-0 pb-3' : 'overflow-y-auto space-y-6'}`}>
            <AnimatePresence mode="wait">
              {activePanel === 'home' && (
                <HomePanel 
                  key="home"
                  lastActivity={lastActivity}
                  fixedDaily={fixedDaily}
                  todayExtras={todayExtras}
                  onToggleTodayExtra={(idx) => handleToggleExtra(todayKey, idx)}
                  monthlyTransactions={monthlyTransactions}
                  onNavigateToPanel={handlePanelSwitch}
                  onAskAi={handleAskAi}
                  settings={settings}
                  todos={todos}
                  shopping={shopping}
                  onToggleTask={handleToggleTask}
                  ideas={ideas}
                  note={note}
                  savingsGoals={savingsGoals}
                />
              )}

              {activePanel !== 'home' && (
                <Suspense fallback={<PanelLoadingFallback key="fallback" />}>
                  {activePanel === 'ai' && (
                    <AiPanel
                      key="ai"
                      threads={chatThreads}
                      activeThreadId={activeThreadId}
                      onSelectThread={handleSelectThread}
                      onNewThread={handleNewThread}
                      onDeleteThread={handleDeleteThread}
                      onRenameThread={handleRenameThread}
                      messages={activeMessages}
                      isLoading={isAiLoading}
                      selectedModel={selectedAiModel}
                      onSelectModel={handleSelectModel}
                      onSendMessage={handleAskAi}
                      onClearHistory={handleClearAiHistory}
                      fixedDaily={fixedDaily}
                      todayExtras={todayExtras}
                      monthlyTransactions={monthlyTransactions}
                      settings={settings}
                      todos={todos}
                      shopping={shopping}
                      ideas={ideas}
                      note={note}
                    />
                  )}

                  {activePanel === 'note' && (
                    <NotePanel 
                      key="note"
                      initialNote={note}
                      onNoteChange={handleNoteChange}
                      settings={settings}
                    />
                  )}

                  {activePanel === 'ideas' && (
                    <IdeasPanel 
                      key="ideas"
                      ideas={ideas}
                      onAddIdea={handleAddIdea}
                      onUpdateIdea={handleUpdateIdea}
                      onDeleteIdea={handleDeleteIdea}
                      onAddLink={handleAddLink}
                      onUpdateLink={handleUpdateLink}
                      onDeleteLink={handleDeleteLink}
                      onAddImage={handleAddImage}
                      onDeleteImage={handleDeleteImage}
                      onOpenLightbox={(src) => {
                        setLightboxSrc(src);
                        setLightboxOpen(true);
                      }}
                      settings={settings}
                    />
                  )}

                  {activePanel === 'edit_assets' && (
                    <EditAssetsPanel 
                      key="edit_assets" 
                      settings={settings} 
                      onOpenLightbox={(src) => {
                        setLightboxSrc(src);
                        setLightboxOpen(true);
                      }}
                    />
                  )}

                  {activePanel === 'routine' && (
                    <RoutinePanel 
                      key={`routine-${panelNavCount}`}
                      initialView={routineSubView}
                      onNavigateToPanel={handlePanelSwitch}
                      fixedDaily={fixedDaily}
                      onUpdateFixedDaily={handleUpdateFixedDaily}
                      weekExtras={weekExtras}
                      onAddExtra={handleAddExtra}
                      onToggleExtra={handleToggleExtra}
                      onDeleteExtra={handleDeleteExtra}
                      onReorderExtras={handleReorderExtras}
                      todos={todos}
                      shopping={shopping}
                      onAddTask={handleAddTask}
                      onToggleTask={handleToggleTask}
                      onDeleteTask={handleDeleteTask}
                      settings={settings}
                      todayExtras={todayExtras}
                      onToggleTodayExtra={(idx) => handleToggleExtra(todayKey, idx)}
                      onAskAi={handleAskAi}
                    />
                  )}

                  {activePanel === 'finance' && (
                    <FinancePanel 
                      key="finance"
                      finance={finance}
                      onAddTransaction={handleAddTransaction}
                      onDeleteTransaction={handleDeleteTransaction}
                      settings={settings}
                      savingsGoals={savingsGoals}
                      onAddSavingsGoal={handleAddSavingsGoal}
                      onAddToSavingsGoal={handleAddToSavingsGoal}
                      onDeleteSavingsGoal={handleDeleteSavingsGoal}
                      onToggleGoalPin={handleToggleGoalPin}
                    />
                  )}

                  {activePanel === 'downloads' && (
                    <DownloadManagerPanel key="downloads" settings={settings} />
                  )}

                  {activePanel === 'dns' && (
                    <DnsChangerPanel key="dns" settings={settings} />
                  )}

                  {activePanel === 'appearance' && (
                    <SettingsPanel 
                      key="appearance"
                      initialTab="appearance"
                      settings={settings}
                      onSettingsChange={onSettingsUpdate}
                      activeTheme={activeTheme}
                      onThemeChange={setActiveTheme}
                    />
                  )}

                  {activePanel === 'settings' && (
                    <SettingsPanel 
                      key={`settings-${settingsTab}`} 
                      initialTab={settingsTab}
                      settings={settings}
                      onSettingsChange={onSettingsUpdate}
                      activeTheme={activeTheme}
                      onThemeChange={setActiveTheme}
                    />
                  )}
                </Suspense>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Mobile Navigation and Floating Buttons */}
        <MobileBottomNav 
          activePanel={activePanel}
          onPanelChange={handlePanelSwitch}
          settings={settings}
          onPreloadPanel={preloadPanel}
          settingsTab={settingsTab}
        />
      </div>

      {/* Lightbox Modal */}
      <LightboxModal 
        isOpen={lightboxOpen}
        src={lightboxSrc}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Global Search */}
      <GlobalSearch
        isOpen={searchOpen}
        onClose={closeSearch}
        onNavigate={handlePanelSwitch}
        isEn={settings.language === 'en'}
        ideas={ideas}
        todos={todos}
        shopping={shopping}
        note={note}
        finance={finance}
        maskAmounts={Boolean(settings.privacyMode)}
      />
    </div>
  );
}
