/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { loadFromLocalStorage, saveToLocalStorage, getDayKeyFromWeekDay, getGeminiKey, getAiProxyUrl, getAiProviderConfig } from '../lib/utils';
import { isDesktopApp } from '../lib/notifications';
import { ChatMessage, ChatThread } from '../types';

async function callAiApi(payload: Record<string, any>): Promise<{ text?: string; functionCalls?: any[]; error?: string }> {
  if (isDesktopApp() && (window as any).corelyDesktop?.ai?.chat) {
    try {
      const result = await (window as any).corelyDesktop.ai.chat(payload);
      return result;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'خطا در ارتباط با هوش مصنوعی.' };
    }
  }

  return {
    error: 'دستیار هوشمند فقط در نسخه دسکتاپ فعال است. / The AI assistant is only available in the desktop version.'
  };
}

export interface UseAiChatOptions {
  onAddTask?: (
    type: 'todos' | 'shopping',
    text: string,
    priority?: 'urgent' | 'important' | 'normal',
    category?: string
  ) => void;
  onAddWeeklyTask?: (key: string, text: string) => void;
  onAddTransaction?: (
    type: 'expense' | 'income',
    amount: number,
    category: string,
    desc: string
  ) => void;
  onAppendNote?: (text: string) => void;
}

export function useAiChat(options?: UseAiChatOptions) {
  // AI Chat History & Multi-Session Memory State
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(() => {
    try {
      const saved = localStorage.getItem('v3_chat_threads');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      // Migrate legacy single-chat messages if present
      const legacyMsgsRaw = localStorage.getItem('v3_ai_messages');
      const legacyMsgs = legacyMsgsRaw ? JSON.parse(legacyMsgsRaw) : [];
      return [
        {
          id: `thread-${Date.now()}`,
          title: 'گفتگوی عمومی',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: legacyMsgs
        }
      ];
    } catch {
      return [
        {
          id: `thread-${Date.now()}`,
          title: 'گفتگوی عمومی',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: []
        }
      ];
    }
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    const saved = localStorage.getItem('v3_active_thread_id');
    if (saved && chatThreads.some((t) => t.id === saved)) {
      return saved;
    }
    return chatThreads[0] ? chatThreads[0].id : `thread-${Date.now()}`;
  });

  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [selectedAiModel, setSelectedAiModel] = useState<string>(() => {
    const saved = loadFromLocalStorage<string>('v3_selected_ai_model', 'balanced');
    const validStyles = ['balanced', 'fast-concise', 'deep-analysis', 'step-by-step', 'creative'];
    if (!validStyles.includes(saved)) {
      return 'balanced';
    }
    return saved;
  });

  // Derived active thread and active messages
  const activeThread = chatThreads.find((t) => t.id === activeThreadId) || chatThreads[0] || {
    id: 'thread-default',
    title: 'گفتگوی جدید',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };
  const activeMessages = activeThread ? activeThread.messages : [];

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    saveToLocalStorage('v3_active_thread_id', threadId);
  };

  const handleNewThread = () => {
    const newThread: ChatThread = {
      id: `thread-${Date.now()}`,
      title: 'گفتگوی جدید',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    setChatThreads((prev) => {
      const updated = [newThread, ...prev];
      saveToLocalStorage('v3_chat_threads', updated);
      return updated;
    });
    setActiveThreadId(newThread.id);
    saveToLocalStorage('v3_active_thread_id', newThread.id);
  };

  const handleDeleteThread = (threadId: string) => {
    setChatThreads((prev) => {
      const filtered = prev.filter((t) => t.id !== threadId);
      const remaining = filtered.length > 0 ? filtered : [
        {
          id: `thread-${Date.now()}`,
          title: 'گفتگوی جدید',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: []
        }
      ];
      saveToLocalStorage('v3_chat_threads', remaining);
      if (activeThreadId === threadId) {
        const nextId = remaining[0].id;
        setActiveThreadId(nextId);
        saveToLocalStorage('v3_active_thread_id', nextId);
      }
      return remaining;
    });
  };

  const handleRenameThread = (threadId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setChatThreads((prev) => {
      const updated = prev.map((t) => (t.id === threadId ? { ...t, title: newTitle.trim() } : t));
      saveToLocalStorage('v3_chat_threads', updated);
      return updated;
    });
  };

  const handleClearAiHistory = () => {
    setChatThreads((prev) => {
      const updated = prev.map((t) => {
        if (t.id === activeThreadId) {
          return { ...t, messages: [] };
        }
        return t;
      });
      saveToLocalStorage('v3_chat_threads', updated);
      return updated;
    });
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedAiModel(modelId);
    saveToLocalStorage('v3_selected_ai_model', modelId);
  };

  const handleAskAi = async (
    promptText: string,
    getContextData?: () => Record<string, unknown>,
    onNavigateToAi?: () => void
  ) => {
    if (!promptText.trim()) return;

    let currentThreadId = activeThreadId;
    let targetThread = chatThreads.find((t) => t.id === currentThreadId);

    if (!targetThread) {
      const newId = `thread-${Date.now()}`;
      targetThread = {
        id: newId,
        title: 'گفتگوی جدید',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      };
      currentThreadId = newId;
    }

    // Extract recent conversation history from this specific active thread
    const historyToSend = targetThread.messages.slice(-16).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      text: m.text
    }));

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    };

    // Auto-generate title if thread title is placeholder
    const autoTitle = (targetThread.title === 'گفتگوی عمومی' || targetThread.title === 'گفتگوی جدید') && targetThread.messages.length === 0
      ? (promptText.slice(0, 32).trim() + (promptText.length > 32 ? '...' : ''))
      : targetThread.title;

    // 1. Append user message to active thread
    setChatThreads((prev) => {
      let found = false;
      const updated = prev.map((t) => {
        if (t.id === currentThreadId) {
          found = true;
          return {
            ...t,
            title: autoTitle,
            updatedAt: new Date().toISOString(),
            messages: [...t.messages, userMsg]
          };
        }
        return t;
      });
      if (!found && targetThread) {
        updated.unshift({
          ...targetThread,
          title: autoTitle,
          updatedAt: new Date().toISOString(),
          messages: [userMsg]
        });
      }
      saveToLocalStorage('v3_chat_threads', updated);
      return updated;
    });

    // 2. Switch panel to 'ai' if callback provided
    if (onNavigateToAi) {
      onNavigateToAi();
    }

    // 3. Set loading
    setIsAiLoading(true);

    // 4. Call backend Gemini API
    try {
      const contextData = getContextData ? getContextData() : {};
      const geminiApiKey = getGeminiKey();
      const aiProxyUrl = getAiProxyUrl();
      const cfg = getAiProviderConfig();
      const data = await callAiApi({
        prompt: promptText,
        model: selectedAiModel,
        history: historyToSend,
        contextData,
        geminiApiKey,
        aiProxyUrl,
        aiProvider: cfg.provider,
        openaiBaseUrl: cfg.baseUrl,
        openaiApiKey: cfg.apiKey,
        openaiModel: cfg.model
      });
      if (data.error) {
        throw new Error(data.error);
      }

      let finalAssistantText = '';

      // Check if Gemini requested tool executions
      if (data.functionCalls && Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
        const functionResponses: Array<{ name: string; id?: string; response: Record<string, unknown> }> = [];

        for (const call of data.functionCalls) {
          const fnName = call.name;
          const args = (call.args || {}) as Record<string, any>;
          let result: Record<string, unknown> = { success: true };

          try {
            if (fnName === 'add_task') {
              const taskType = args.type === 'shopping' ? 'shopping' : 'todos';
              const text = String(args.text || '').trim();
              const priority = args.priority as 'urgent' | 'important' | 'normal' | undefined;
              const category = args.category ? String(args.category).trim() : undefined;

              if (options?.onAddTask && text) {
                options.onAddTask(taskType, text, priority, category);
                result = {
                  success: true,
                  message: `آیتم "${text}" با موفقیت به لیست ${taskType === 'shopping' ? 'خرید' : 'کارها'} افزوده شد.`
                };
              } else {
                result = { success: false, error: 'متن آیتم مشخص نشده است.' };
              }
            } else if (fnName === 'add_weekly_task') {
              const day = String(args.day || '').trim();
              const text = String(args.text || '').trim();

              if (options?.onAddWeeklyTask && day && text) {
                const resolvedDateKey = getDayKeyFromWeekDay(day);
                options.onAddWeeklyTask(resolvedDateKey, text);
                result = {
                  success: true,
                  message: `کار "${text}" برای روز ${day} (${resolvedDateKey}) با موفقیت به برنامه هفتگی اضافه شد.`
                };
              } else {
                result = { success: false, error: 'اطلاعات روز هفته یا متن کار ناقص است.' };
              }
            } else if (fnName === 'add_transaction') {
              const txType = args.type === 'income' ? 'income' : 'expense';
              const amount = Number(args.amount) || 0;
              const category = String(args.category || 'متفرقه').trim();
              const desc = String(args.desc || '').trim();

              if (options?.onAddTransaction && amount > 0) {
                options.onAddTransaction(txType, amount, category, desc);
                result = {
                  success: true,
                  message: `تراکنش ${txType === 'income' ? 'درآمد' : 'هزینه'} به مبلغ ${amount.toLocaleString('fa-IR')} تومان ثبت شد.`
                };
              } else {
                result = { success: false, error: 'مبلغ تراکنش باید عددی معتبر و بزرگتر از صفر باشد.' };
              }
            } else if (fnName === 'append_note') {
              const text = String(args.text || '').trim();
              if (options?.onAppendNote && text) {
                options.onAppendNote(text);
                result = {
                  success: true,
                  message: `متن به انتهای یادداشت اضافه شد.`
                };
              } else {
                result = { success: false, error: 'متنی برای افزودن به یادداشت ارسال نشده است.' };
              }
            } else {
              result = { success: false, error: `تابع ناشناخته: ${fnName}` };
            }
          } catch (err: unknown) {
            result = {
              success: false,
              error: err instanceof Error ? err.message : 'خطای ناشناخته در اجرای تابع'
            };
          }

          functionResponses.push({
            name: fnName,
            id: call.id,
            response: result
          });
        }

        // Send a single follow-up request with function responses to get natural confirmation message
        try {
          const secondData = await callAiApi({
            prompt: promptText,
            model: selectedAiModel,
            history: historyToSend,
            contextData,
            previousFunctionCalls: data.functionCalls,
            functionResponses,
            geminiApiKey,
            aiProxyUrl: getAiProxyUrl(),
            aiProvider: cfg.provider,
            openaiBaseUrl: cfg.baseUrl,
            openaiApiKey: cfg.apiKey,
            openaiModel: cfg.model
          });
          if (!secondData.error && secondData.text) {
            finalAssistantText = secondData.text;
          } else {
            finalAssistantText = 'عملیات درخواستی شما با موفقیت انجام شد.';
          }
        } catch {
          finalAssistantText = 'عملیات درخواستی شما با موفقیت انجام شد.';
        }
      } else {
        finalAssistantText = data.text || 'پاسخی دریافت نشد.';
      }

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        text: finalAssistantText,
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
      };

      // 5. Append assistant message to active thread
      setChatThreads((prev) => {
        const updated = prev.map((t) => {
          if (t.id === currentThreadId) {
            return {
              ...t,
              updatedAt: new Date().toISOString(),
              messages: [...t.messages, aiMsg]
            };
          }
          return t;
        });
        saveToLocalStorage('v3_chat_threads', updated);
        return updated;
      });
    } catch (err: unknown) {
      console.error('AI Error:', err);
      let errorMessage = err instanceof Error ? err.message : 'ارتباط با سرور امکان‌پذیر نشد. لطفاً مجدداً تلاش کنید.';
      try {
        const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.error?.message) {
            if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE' || String(parsed.error.message).includes('high demand')) {
              errorMessage = 'مدل هوش مصنوعی در حال حاضر با تقاضای بالایی مواجه است. لطفاً چند لحظه بعد مجدداً تلاش کنید.';
            } else {
              errorMessage = parsed.error.message;
            }
          }
        }
      } catch {
        // Keep standard message
      }

      if (errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('high demand')) {
        errorMessage = 'مدل هوش مصنوعی در حال حاضر با تقاضای بالایی مواجه است. لطفاً چند لحظه بعد مجدداً تلاش کنید.';
      }

      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        text: `⚠️ خطا: ${errorMessage}`,
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
      };
      setChatThreads((prev) => {
        const updated = prev.map((t) => {
          if (t.id === currentThreadId) {
            return {
              ...t,
              messages: [...t.messages, errorMsg]
            };
          }
          return t;
        });
        saveToLocalStorage('v3_chat_threads', updated);
        return updated;
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  return {
    chatThreads,
    activeThreadId,
    activeThread,
    activeMessages,
    isAiLoading,
    selectedAiModel,
    handleSelectThread,
    handleNewThread,
    handleDeleteThread,
    handleRenameThread,
    handleClearAiHistory,
    handleSelectModel,
    handleAskAi
  };
}
