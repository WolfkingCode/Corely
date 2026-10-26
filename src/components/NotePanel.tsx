/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Copy, Download, Trash2, Plus, StickyNote, Check, Pin } from 'lucide-react';
import { loadFromLocalStorage, saveToLocalStorage } from '../lib/utils';

interface StickyNoteItem {
  id: string;
  title: string;
  content: string;
  color: string; // 'amber' | 'emerald' | 'blue' | 'purple' | 'rose'
  isPinned?: boolean;
  date: string;
}

import { AppSettings } from '../types';

interface NotePanelProps {
  key?: string;
  initialNote: string;
  onNoteChange: (note: string) => boolean | void;
  settings?: AppSettings;
}

const NOTE_COLORS = [
  { name: 'amber', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-200', dot: 'bg-amber-400' },
  { name: 'emerald', bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200', dot: 'bg-emerald-400' },
  { name: 'blue', bg: 'bg-blue-500/10 border-blue-500/20 text-blue-200', dot: 'bg-blue-400' },
  { name: 'purple', bg: 'bg-purple-500/10 border-purple-500/20 text-purple-200', dot: 'bg-purple-400' },
  { name: 'rose', bg: 'bg-rose-500/10 border-rose-500/20 text-rose-200', dot: 'bg-rose-400' },
];

export default function NotePanel({ initialNote, onNoteChange, settings }: NotePanelProps) {
  const isEn = settings?.language === 'en';
  const [activeTab, setActiveTab] = useState<'editor' | 'stickies'>('editor');
  const [noteText, setNoteText] = useState(initialNote);
  const [saveStatus, setSaveStatus] = useState('');
  const [isSaveError, setIsSaveError] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sticky notes state
  const [stickies, setStickies] = useState<StickyNoteItem[]>(() =>
    loadFromLocalStorage<StickyNoteItem[]>('v3_sticky_notes', [
      {
        id: '1',
        title: isEn ? 'Quick Note' : 'یادداشت سریع',
        content: isEn ? 'Write project ideas, key contacts, or daily summaries here.' : 'ایده‌های پروژه، تلفن‌های ضروری یا خلاصه‌های روزانه را اینجا بنویسید.',
        color: 'amber',
        isPinned: true,
        date: new Date().toLocaleDateString(isEn ? 'en-US' : 'fa-IR')
      }
    ])
  );

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedColor, setSelectedColor] = useState('amber');

  useEffect(() => {
    setNoteText(initialNote);
  }, [initialNote]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNoteText(val);
    const res = onNoteChange(val);
    if (res === false) {
      setIsSaveError(true);
      setSaveStatus(isEn ? 'Not saved, storage is full' : 'ذخیره نشد، حافظه پر است');
    } else {
      setIsSaveError(false);
      setSaveStatus(isEn ? 'Saved ✓' : 'ذخیره شد ✓');
    }
  };

  useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => {
        setSaveStatus('');
        setIsSaveError(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(noteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([noteText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    element.href = url;
    element.download = `note-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);
  };

  // Sticky notes handlers
  const handleAddSticky = () => {
    if (!newContent.trim()) return;
    const item: StickyNoteItem = {
      id: Date.now().toString(),
      title: newTitle.trim() || (isEn ? 'Note' : 'یادداشت'),
      content: newContent.trim(),
      color: selectedColor,
      date: new Date().toLocaleDateString(isEn ? 'en-US' : 'fa-IR')
    };
    const updated = [item, ...stickies];
    setStickies(updated);
    saveToLocalStorage('v3_sticky_notes', updated);
    setNewTitle('');
    setNewContent('');
  };

  const handleDeleteSticky = (id: string) => {
    const updated = stickies.filter(s => s.id !== id);
    setStickies(updated);
    saveToLocalStorage('v3_sticky_notes', updated);
  };

  const handleTogglePin = (id: string) => {
    const updated = stickies.map(s => s.id === id ? { ...s, isPinned: !s.isPinned } : s);
    setStickies(updated);
    saveToLocalStorage('v3_sticky_notes', updated);
  };

  // Stats
  const wordCount = noteText.trim() ? noteText.trim().split(/\s+/).length : 0;
  const charCount = noteText.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="glass-card flex flex-col space-y-4"
    >
      {/* Top Header & Tabs */}
      <div className="card-header flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card-bg)] rounded-t-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isEn ? 'Main Notepad' : 'دفترچه یادداشت اصلی'}</span>
          </button>
          <button
            onClick={() => setActiveTab('stickies')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'stickies'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            <StickyNote className="w-4 h-4" />
            <span>{isEn ? `Quick Sticky Cards (${stickies.length})` : `کارت‌های یادداشت سریع (${stickies.length.toLocaleString('fa-IR')})`}</span>
          </button>
        </div>

        {activeTab === 'editor' && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium h-4 transition-opacity ml-2 ${isSaveError ? 'text-red-400' : 'text-green-400'}`}>{saveStatus}</span>
            <button
              onClick={handleCopyText}
              className="p-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] text-xs transition-all cursor-pointer flex items-center gap-1.5"
              title={isEn ? 'Copy text' : 'کپی متن'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? (isEn ? 'Copied' : 'کپی شد') : (isEn ? 'Copy' : 'کپی')}</span>
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] text-xs transition-all cursor-pointer flex items-center gap-1.5"
              title={isEn ? 'Download text file' : 'دانلود فایل متنی'}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEn ? 'Download' : 'دانلود'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor View */}
      {activeTab === 'editor' && (
        <div className="card-body p-4 flex flex-col flex-1 space-y-3">
          <textarea
            className="note-textarea w-full min-h-[55vh] bg-transparent border-none text-sm leading-relaxed resize-none outline-none focus:ring-0 text-right text-[var(--text)] placeholder-[var(--text3)] selectable"
            dir="rtl"
            value={noteText}
            onChange={handleChange}
            placeholder={isEn ? 'Start typing... (Notes are saved automatically)' : 'شروع به نوشتن کنید... (یادداشت‌ها به طور خودکار ذخیره می‌شوند)'}
          />

          <div className="flex items-center justify-between text-[11px] text-[var(--text3)] pt-3 border-t border-[var(--border)]">
            <div className="flex gap-4 font-mono">
              <span>{isEn ? `Words: ${wordCount}` : `کلمات: ${wordCount.toLocaleString('fa-IR')}`}</span>
              <span>{isEn ? `Characters: ${charCount}` : `کاراکترها: ${charCount.toLocaleString('fa-IR')}`}</span>
            </div>
            <span>{isEn ? 'Auto-save enabled' : 'ذخیره‌سازی خودکار فعال است'}</span>
          </div>
        </div>
      )}

      {/* Stickies View */}
      {activeTab === 'stickies' && (
        <div className="p-4 space-y-6">
          {/* Add Sticky Form */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] p-4 rounded-2xl space-y-3">
            <div className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>{isEn ? 'Add New Sticky Card' : 'افزودن کارت یادداشت جدید'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={isEn ? 'Card title (optional)' : 'عنوان کارت (اختیاری)'}
                className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-right outline-none text-[var(--text)] placeholder-[var(--text3)]"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text3)]">{isEn ? 'Card color:' : 'رنگ کارت:'}</span>
                <div className="flex items-center gap-1.5">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c.name)}
                      className={`w-6 h-6 rounded-full ${c.dot} transition-transform cursor-pointer ${
                        selectedColor === c.name ? 'scale-125 ring-2 ring-white/50' : 'opacity-70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={isEn ? 'Quick note text...' : 'متن یادداشت سریع...'}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl p-3 text-xs text-right outline-none text-[var(--text)] placeholder-[var(--text3)] resize-none h-20"
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddSticky}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Add Note' : 'ثبت یادداشت'}</span>
              </button>
            </div>
          </div>

          {/* Stickies Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stickies.length === 0 ? (
              <div className="col-span-full text-center py-10 text-xs text-[var(--text3)]">
                {isEn ? 'No sticky note cards added yet.' : 'هنوز کارت یادداشتی اضافه نکرده‌اید.'}
              </div>
            ) : (
              stickies
                .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
                .map((sticky) => {
                  const colorObj = NOTE_COLORS.find(c => c.name === sticky.color) || NOTE_COLORS[0];
                  return (
                    <motion.div
                      key={sticky.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 relative overflow-hidden ${colorObj.bg}`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
                        <span className="font-bold text-xs leading-tight line-clamp-1 break-words selectable">{sticky.title}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleTogglePin(sticky.id)}
                            className={`p-1 rounded hover:bg-white/10 transition-all ${sticky.isPinned ? 'text-amber-400' : 'text-gray-400'}`}
                            title={isEn ? 'Pin note' : 'پین کردن'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSticky(sticky.id)}
                            className="p-1 rounded text-red-400 hover:bg-white/10 transition-all"
                            title={isEn ? 'Delete' : 'حذف'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                        <p className="text-xs leading-relaxed whitespace-pre-wrap text-right font-normal break-words [word-break:break-word] selectable">
                          {sticky.content}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] opacity-60 pt-1 border-t border-white/5">
                        <span>{sticky.date}</span>
                        {sticky.isPinned && <span className="font-semibold text-amber-300">{isEn ? '📌 Pinned' : '📌 پین شده'}</span>}
                      </div>
                    </motion.div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
