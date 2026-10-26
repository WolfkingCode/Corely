/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lightbulb, 
  Plus, 
  Search, 
  Trash2, 
  ExternalLink, 
  Link2, 
  Image as ImageIcon, 
  X, 
  CheckCircle2, 
  Clock, 
  Circle, 
  Sparkles,
  MessageSquare,
  FileText,
  Copy,
  Check,
  ChevronLeft,
  Paperclip,
  Eye,
  Pencil,
  Download,
  Send
} from 'lucide-react';
import { Idea, IdeaComment, IdeaFile, AppSettings } from '../types';

interface IdeasPanelProps {
  key?: string;
  ideas: Idea[];
  onAddIdea: () => void;
  onUpdateIdea: (id: number, field: keyof Idea, value: any) => void;
  onDeleteIdea: (id: number) => void;
  onAddLink: (id: number) => void;
  onUpdateLink: (id: number, idx: number, value: string) => void;
  onDeleteLink: (id: number, idx: number) => void;
  onAddImage: (id: number, base64Src: string) => void;
  onDeleteImage: (id: number, idx: number) => void;
  onOpenLightbox: (src: string) => void;
  settings?: AppSettings;
}

const getStatusConfig = (st: number, isEn: boolean) => {
  const configs: Record<number, { label: string; color: string; bg: string; border: string; icon: any }> = {
    0: { 
      label: isEn ? 'Not Started' : 'شروع نشده', 
      color: 'text-amber-500 dark:text-amber-400', 
      bg: 'bg-amber-500/10', 
      border: 'border-amber-500/20',
      icon: Circle 
    },
    1: { 
      label: isEn ? 'In Progress' : 'در حال انجام', 
      color: 'text-blue-500 dark:text-blue-400', 
      bg: 'bg-blue-500/10', 
      border: 'border-blue-500/20',
      icon: Clock 
    },
    2: { 
      label: isEn ? 'Completed' : 'تکمیل شده', 
      color: 'text-emerald-500 dark:text-emerald-400', 
      bg: 'bg-emerald-500/10', 
      border: 'border-emerald-500/20',
      icon: CheckCircle2 
    },
  };
  return configs[st] || configs[0];
};

export default function IdeasPanel({
  ideas,
  onAddIdea,
  onUpdateIdea,
  onDeleteIdea,
  onAddLink,
  onUpdateLink,
  onDeleteLink,
  onAddImage,
  onDeleteImage,
  onOpenLightbox,
  settings
}: IdeasPanelProps) {
  const isEn = settings?.language === 'en';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(30);
  const [activeIdeaId, setActiveIdeaId] = useState<number | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);

  // Reset pagination on search or filter change
  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, statusFilter]);

  // Modal local state
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);

  // Note creation inside unified container
  const [noteImage, setNoteImage] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteImageInputRef = useRef<HTMLInputElement>(null);

  // Active Idea Object
  const activeIdea = ideas.find(i => i.id === activeIdeaId) || null;

  // Filtered Ideas
  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = (idea.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (idea.desc || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || idea.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const visibleIdeas = filteredIdeas.slice(0, visibleCount);

  // Handle image upload and resize for main description attachments
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeIdeaId || !activeIdea || !e.target.files) return;
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert(isEn ? `Image ${file.name} exceeds 20MB.` : `حجم تصویر ${file.name} بیشتر از ۲۰ مگابایت است.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const resultSrc = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        let dataUrl = resultSrc;
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }

        const currentImages = activeIdea.images || [];
        onUpdateIdea(activeIdea.id, 'images', [...currentImages, dataUrl]);
      };
      img.src = resultSrc;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle note image selection for note sender
  const handleNoteImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert(isEn ? `Image ${file.name} exceeds 20MB.` : `حجم تصویر ${file.name} بیشتر از ۲۰ مگابایت است.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const resultSrc = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        let dataUrl = resultSrc;
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }
        setNoteImage(dataUrl);
      };
      img.src = resultSrc;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle sending note (photo + caption or text-only)
  const handleSendNote = () => {
    if (!activeIdeaId || (!noteText.trim() && !noteImage)) return;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
    const timestamp = `${timeStr} - ${dateStr}`;

    const newComment: IdeaComment = {
      id: `cm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: noteText.trim(),
      image: noteImage || undefined,
      timestamp
    };

    const currentComments = activeIdea?.comments || [];
    onUpdateIdea(activeIdeaId, 'comments', [...currentComments, newComment]);

    // Reset input fields
    setNoteText('');
    setNoteImage(null);
  };

  // Handle document/file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeIdeaId || !activeIdea || !e.target.files) return;
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert(isEn ? `File ${file.name} exceeds 25MB.` : `حجم فایل ${file.name} بیشتر از ۲۵ مگابایت است.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const resultSrc = event.target?.result as string;
      const newFileObj: IdeaFile = {
        id: `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        url: resultSrc,
        type: file.type
      };

      const currentFiles = activeIdea.files || [];
      onUpdateIdea(activeIdea.id, 'files', [...currentFiles, newFileObj]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Delete attached file
  const handleDeleteFile = (fileIndex: number) => {
    if (!activeIdea) return;
    const currentFiles = [...(activeIdea.files || [])];
    currentFiles.splice(fileIndex, 1);
    onUpdateIdea(activeIdea.id, 'files', currentFiles);
  };

  // Add Link
  const handleConfirmAddLink = () => {
    if (!activeIdea || !newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const currentLinks = activeIdea.links || [];
    onUpdateIdea(activeIdea.id, 'links', [...currentLinks, url]);
    setNewLinkUrl('');
    setShowLinkInput(false);
  };

  // Copy Link Helper
  const handleCopyLink = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkIndex(index);
    setTimeout(() => setCopiedLinkIndex(null), 2000);
  };

  // Delete legacy comment
  const handleDeleteComment = (commentId: string) => {
    if (!activeIdeaId || !activeIdea) return;
    const updated = (activeIdea.comments || []).filter(c => c.id !== commentId);
    onUpdateIdea(activeIdeaId, 'comments', updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6"
    >
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.doc,.docx,.txt,.zip,video/*,audio/*,*"
        className="hidden"
      />
      <input
        type="file"
        ref={noteImageInputRef}
        onChange={handleNoteImageSelect}
        accept="image/*"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-600/15 via-blue-500/5 to-cyan-500/10 border border-blue-500/20 p-5 sm:p-6 shadow-sm backdrop-blur-xs relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Lightbulb className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[var(--text)] flex items-center gap-2">
              <span>{isEn ? 'Ideas & Innovation Hub' : 'بانک ایده‌ها و نوآوری‌ها'}</span>
              <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
            </h2>
            <p className="text-xs text-[var(--text2)] mt-1 font-medium">
              {isEn ? 'Organize your creative concepts, notes, and attachments easily' : 'ایده‌ها، یادداشت‌ها و پیوست‌های خلاقانه خود را ساده و مرتب ثبت کنید'}
            </p>
          </div>
        </div>

        <button
          onClick={onAddIdea}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>{isEn ? 'Add New Idea' : 'ثبت ایده جدید'}</span>
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 bg-[var(--card-bg)] border border-[var(--border)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[var(--text3)]">{isEn ? 'Total Ideas' : 'کل ایده‌ها'}</p>
            <p className="text-xl font-black text-[var(--text)] mt-0.5">{ideas.length}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
            <Lightbulb className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-[var(--card-bg)] border border-[var(--border)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[var(--text3)]">{isEn ? 'Not Started' : 'شروع نشده'}</p>
            <p className="text-xl font-black text-amber-500 mt-0.5">
              {ideas.filter(i => i.status === 0).length}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
            <Circle className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-[var(--card-bg)] border border-[var(--border)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[var(--text3)]">{isEn ? 'In Progress' : 'در حال انجام'}</p>
            <p className="text-xl font-black text-blue-500 mt-0.5">
              {ideas.filter(i => i.status === 1).length}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-[var(--card-bg)] border border-[var(--border)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[var(--text3)]">{isEn ? 'Completed' : 'تکمیل شده'}</p>
            <p className="text-xl font-black text-emerald-500 mt-0.5">
              {ideas.filter(i => i.status === 2).length}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[var(--text3)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isEn ? 'Search in title or description...' : 'جستجو در عنوان یا متن ایده...'}
            className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] text-xs text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] hover:text-[var(--text)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] overflow-x-auto w-full sm:w-auto shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            {isEn ? `All (${ideas.length})` : `همه (${ideas.length})`}
          </button>
          {[0, 1, 2].map(st => {
            const cfg = getStatusConfig(st, isEn);
            const count = ideas.filter(i => i.status === st).length;
            const isSelected = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? `${cfg.bg} ${cfg.color} border ${cfg.border}`
                    : 'text-[var(--text3)] hover:text-[var(--text)]'
                }`}
              >
                <cfg.icon className="w-3.5 h-3.5" />
                <span>{cfg.label} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ideas Grid */}
      {filteredIdeas.length === 0 ? (
        <div className="rounded-3xl p-12 bg-[var(--card-bg)] border border-[var(--border)] text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
            <Lightbulb className="w-8 h-8 opacity-60" />
          </div>
          <p className="text-sm font-bold text-[var(--text2)]">{isEn ? 'No ideas found' : 'هیچ ایده‌ای یافت نشد'}</p>
          <p className="text-xs text-[var(--text3)]">
            {searchQuery ? (isEn ? 'Try modifying your search query' : 'جستجوی خود را تغییر دهید') : (isEn ? 'Add your first new idea using the button above.' : 'اولین ایده جدید خود را با دکمه بالا ثبت کنید.')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {visibleIdeas.map((idea) => {
              const statusCfg = getStatusConfig(idea.status, isEn);
              const StatusIcon = statusCfg.icon;

              const totalImages = idea.images?.length || 0;
              const totalLinks = idea.links?.filter(Boolean).length || 0;
              const totalFiles = idea.files?.length || 0;
              const totalComments = idea.comments?.length || 0;

              return (
                <motion.div
                  key={idea.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl p-5 bg-[var(--card-bg)] border border-[var(--border)] hover:border-blue-500/30 transition-all duration-200 shadow-xs hover:shadow-lg flex flex-col justify-between space-y-4 group relative"
                >
                  <div className="space-y-3">
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2">
                      {/* Status Toggle Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextStatus = (idea.status + 1) % 3;
                          onUpdateIdea(idea.id, 'status', nextStatus);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}
                        title={isEn ? 'Click to change status' : 'جهت تغییر وضعیت کلیک کنید'}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{statusCfg.label}</span>
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onDeleteIdea(idea.id)}
                          className="p-1.5 rounded-lg text-[var(--text3)] hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                          title={isEn ? 'Delete idea' : 'حذف ایده'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Title with edit button */}
                    {editingTitleId === idea.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={idea.title}
                          onChange={(e) => onUpdateIdea(idea.id, 'title', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setEditingTitleId(null);
                          }}
                          autoFocus
                          placeholder={isEn ? 'Write idea title...' : 'عنوان ایده را بنویسید...'}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-blue-500/80 text-sm font-black text-[var(--text)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingTitleId(null)}
                          className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold transition cursor-pointer shrink-0"
                          title={isEn ? 'Save' : 'ذخیره'}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 group/title">
                        <h3 
                          onClick={() => {
                            setActiveIdeaId(idea.id);
                            setNoteImage(null);
                            setNoteText('');
                          }}
                          className="text-base font-black text-[var(--text)] line-clamp-2 cursor-pointer hover:text-blue-400 transition flex-1 selectable"
                        >
                          {idea.title || (isEn ? 'Untitled Idea' : 'ایده بدون عنوان')}
                        </h3>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTitleId(idea.id);
                          }}
                          className="p-1.5 rounded-lg text-[var(--text3)] hover:text-blue-400 hover:bg-blue-500/10 transition cursor-pointer shrink-0"
                          title={isEn ? 'Edit title' : 'ویرایش عنوان'}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Desc Preview */}
                    <p 
                      onClick={() => {
                        setActiveIdeaId(idea.id);
                        setNoteImage(null);
                        setNoteText('');
                      }}
                      className="text-xs text-[var(--text2)] line-clamp-3 leading-relaxed cursor-pointer font-medium selectable"
                    >
                      {idea.desc ? idea.desc.replace(/🖼️\s*\[تصویر \d+ پیوست شد\]/g, '').trim() : (isEn ? 'No description written yet. Click to add details...' : 'توضیحاتی ثبت نشده است. برای افزودن کلیک کنید...')}
                    </p>

                    {/* Attached Images preview thumbnails if any */}
                    {idea.images && idea.images.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                        {idea.images.slice(0, 3).map((imgSrc, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => onOpenLightbox(imgSrc)}
                            className="w-10 h-10 rounded-lg overflow-hidden border border-[var(--border)] shrink-0 cursor-pointer hover:opacity-80 transition bg-black/10"
                          >
                            <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {idea.images.length > 3 && (
                          <span className="text-[10px] font-bold text-[var(--text3)] px-1">
                            +{idea.images.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text3)]">
                    <div className="flex items-center gap-2 flex-wrap">
                      {totalImages > 0 && (
                        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                          <ImageIcon className="w-3 h-3" />
                          <span>{totalImages}</span>
                        </span>
                      )}
                      {totalLinks > 0 && (
                        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <Link2 className="w-3 h-3" />
                          <span>{totalLinks}</span>
                        </span>
                      )}
                      {totalFiles > 0 && (
                        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                          <Paperclip className="w-3 h-3" />
                          <span>{totalFiles}</span>
                        </span>
                      )}
                      {totalComments > 0 && (
                        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          <MessageSquare className="w-3 h-3" />
                          <span>{totalComments}</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setActiveIdeaId(idea.id);
                        setNoteImage(null);
                        setNoteText('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>{isEn ? 'Open' : 'باز کردن'}</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filteredIdeas.length > visibleCount && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setVisibleCount(prev => prev + 30)}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text2)] hover:text-blue-500 hover:border-blue-500/40 transition cursor-pointer active:scale-95 shadow-2xs"
            >
              {isEn ? 'Show more' : 'نمایش بیشتر'}
            </button>
          </div>
        )}
      </div>
    )}

      {/* Unified Single-Box Idea Modal */}
      <AnimatePresence>
        {activeIdea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] rounded-3xl modal-acrylic border border-white/20 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-right"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-white/40 dark:bg-slate-900/40">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-[var(--text)] truncate">
                      {activeIdea.title || (isEn ? 'Idea Details' : 'جزئیات ایده')}
                    </h3>
                    <p className="text-[11px] text-[var(--text3)]">{activeIdea.date}</p>
                  </div>
                </div>

                {/* Status Pills */}
                <div className="flex items-center gap-1 bg-[var(--input-bg)] p-1 rounded-2xl border border-[var(--border)] shrink-0">
                  {[0, 1, 2].map(st => {
                    const cfg = getStatusConfig(st, isEn);
                    const isSelected = activeIdea.status === st;
                    return (
                      <button
                        key={st}
                        onClick={() => onUpdateIdea(activeIdea.id, 'status', st)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 press-feedback ${
                          isSelected
                            ? `${cfg.bg} ${cfg.color} border ${cfg.border}`
                            : 'text-[var(--text3)] hover:text-[var(--text)]'
                        }`}
                      >
                        <cfg.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    setActiveIdeaId(null);
                    setShowLinkInput(false);
                    setNoteImage(null);
                    setNoteText('');
                  }}
                  className="p-2 rounded-2xl text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--border)] transition cursor-pointer shrink-0 press-feedback"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
                {/* Unified Notes & Attachments Chat Container */}
                <div className="rounded-3xl bg-[var(--input-bg)]/50 border border-[var(--border)] p-4 space-y-4 focus-within:border-blue-500/50 transition flex flex-col">
                  {/* Messages & Attachments List */}
                  <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1 scrollbar-thin">
                    {/* 1. Legacy Idea Description (Read-only first message if exists) */}
                    {activeIdea.desc && activeIdea.desc.trim() && (
                      <div className="rounded-2xl p-3 bg-[var(--card-bg)] border border-[var(--border)]/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-[10.5px] text-[var(--text3)]">
                          <span className="flex items-center gap-1.5 font-bold text-blue-500 dark:text-blue-400">
                            <FileText className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Description' : 'توضیحات ایده'}</span>
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--input-bg)] text-[var(--text3)] border border-[var(--border)]/40">
                            {isEn ? 'Read-only' : 'فقط خواندنی'}
                          </span>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-[var(--border)]/50 bg-[var(--input-bg)]/40 p-3 text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap selectable font-medium">
                          {activeIdea.desc}
                        </div>
                      </div>
                    )}

                    {/* 2. Attachments (Images, Links, Files) */}
                    {((activeIdea.images && activeIdea.images.length > 0) ||
                      (activeIdea.links && activeIdea.links.filter(Boolean).length > 0) ||
                      (activeIdea.files && activeIdea.files.length > 0)) && (
                      <div className="space-y-2.5">
                        {/* Image previews row */}
                        {activeIdea.images && activeIdea.images.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {activeIdea.images.map((imgSrc, idx) => (
                              <div
                                key={`img-${idx}`}
                                className="relative group/thumb w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-[var(--border)] bg-black/10 shadow-xs"
                              >
                                <img
                                  src={imgSrc}
                                  alt=""
                                  onClick={() => onOpenLightbox(imgSrc)}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center gap-1 pointer-events-none">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenLightbox(imgSrc);
                                    }}
                                    className="p-1 rounded-md bg-black/70 text-white hover:bg-black pointer-events-auto transition cursor-pointer"
                                    title={isEn ? 'View' : 'مشاهده'}
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteImage(activeIdea.id, idx);
                                    }}
                                    className="p-1 rounded-md bg-red-600/80 text-white hover:bg-red-600 pointer-events-auto transition cursor-pointer"
                                    title={isEn ? 'Delete' : 'حذف'}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Links previews row */}
                        {activeIdea.links && activeIdea.links.filter(Boolean).length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {activeIdea.links.map((linkUrl, idx) => {
                              if (!linkUrl) return null;
                              return (
                                <div
                                  key={`link-${idx}`}
                                  className="flex items-center justify-between gap-2 p-2 px-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] text-xs text-[var(--text)] group"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1" dir="ltr">
                                    <Link2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    <a
                                      href={linkUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="truncate text-blue-400 hover:underline font-mono text-[11px]"
                                    >
                                      {linkUrl}
                                    </a>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLink(linkUrl, idx)}
                                      className="p-1 rounded-md text-[var(--text3)] hover:text-[var(--text)] transition cursor-pointer"
                                      title={isEn ? 'Copy link' : 'کپی لینک'}
                                    >
                                      {copiedLinkIndex === idx ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                    <a
                                      href={linkUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded-md text-[var(--text3)] hover:text-blue-400 transition"
                                      title={isEn ? 'Open in new tab' : 'باز کردن در تب جدید'}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteLink(activeIdea.id, idx)}
                                      className="p-1 rounded-md text-[var(--text3)] hover:text-red-500 transition cursor-pointer"
                                      title={isEn ? 'Remove link' : 'حذف لینک'}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Files previews row */}
                        {activeIdea.files && activeIdea.files.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {activeIdea.files.map((fileObj, idx) => (
                              <div
                                key={fileObj.id || `file-${idx}`}
                                className="flex items-center justify-between gap-2 p-2 px-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] text-xs text-[var(--text)] group"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                                    <FileText className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="truncate font-semibold text-[11px]">
                                    {fileObj.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <a
                                    href={fileObj.url}
                                    download={fileObj.name}
                                    className="p-1 px-2 rounded-lg text-[var(--text3)] hover:text-purple-400 hover:bg-[var(--input-bg)] transition flex items-center gap-1 text-[10.5px] font-bold"
                                    title={isEn ? 'Download' : 'دانلود'}
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>{isEn ? 'Download' : 'دانلود'}</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFile(idx)}
                                    className="p-1 rounded-md text-[var(--text3)] hover:text-red-500 transition cursor-pointer"
                                    title={isEn ? 'Remove file' : 'حذف فایل'}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. Notes / Comments Timeline */}
                    {activeIdea.comments && activeIdea.comments.length > 0 && (
                      <div className="space-y-2.5">
                        {activeIdea.comments.map((cm) => (
                          <div
                            key={cm.id}
                            className="rounded-2xl p-3 bg-[var(--card-bg)] border border-[var(--border)]/80 shadow-2xs space-y-2 relative group"
                          >
                            <div className="flex items-center justify-between text-[10.5px] text-[var(--text3)]">
                              <span>{cm.timestamp}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(cm.id)}
                                className="opacity-0 group-hover:opacity-100 transition p-1 rounded-md text-red-400 hover:bg-red-500/10 cursor-pointer"
                                title={isEn ? 'Delete message' : 'حذف این یادداشت'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Telegram-style unified container */}
                            <div className="rounded-xl overflow-hidden border border-[var(--border)]/50 bg-[var(--input-bg)]/40">
                              {cm.image && (
                                <div className="relative group/img">
                                  <img
                                    src={cm.image}
                                    alt=""
                                    className="w-full max-h-52 object-cover cursor-pointer hover:opacity-95 transition"
                                    onClick={() => onOpenLightbox(cm.image!)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => onOpenLightbox(cm.image!)}
                                    className="absolute bottom-2 left-2 p-1.5 rounded-lg bg-black/70 text-white backdrop-blur-xs opacity-0 group-hover/img:opacity-100 transition cursor-pointer"
                                    title={isEn ? 'View large' : 'مشاهده بزرگ'}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {cm.fileUrl && (
                                <div className="p-2 border-b border-[var(--border)]/40">
                                  {cm.fileType?.startsWith('video/') ? (
                                    <video src={cm.fileUrl} controls className="max-w-full rounded-lg max-h-40" />
                                  ) : (
                                    <a
                                      href={cm.fileUrl}
                                      download={cm.fileName || 'file'}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:underline"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span className="truncate">{cm.fileName || (isEn ? 'Download file' : 'دانلود فایل پیوست')}</span>
                                    </a>
                                  )}
                                </div>
                              )}

                              {cm.text && (
                                <div className="p-2.5 text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap font-medium selectable">
                                  {cm.text}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty State when no notes, attachments, or description */}
                    {!(
                      (activeIdea.desc && activeIdea.desc.trim()) ||
                      (activeIdea.images && activeIdea.images.length > 0) ||
                      (activeIdea.links && activeIdea.links.filter(Boolean).length > 0) ||
                      (activeIdea.files && activeIdea.files.length > 0) ||
                      (activeIdea.comments && activeIdea.comments.length > 0)
                    ) && (
                      <div className="text-center py-8 text-xs text-[var(--text3)]">
                        {isEn
                          ? 'No notes or attachments yet. Write a note or add a link/file below.'
                          : 'هنوز یادداشت یا پیوستی ثبت نشده است. با نوشتن یادداشت یا افزودن لینک/فایل در زیر شروع کنید.'}
                      </div>
                    )}
                  </div>

                  {/* Bottom Chat & Attachment Controls */}
                  <div className="pt-3 border-t border-[var(--border)]/60 space-y-2">
                    {/* Note Image Preview */}
                    {noteImage && (
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--card-bg)] border border-purple-500/30">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-[var(--border)] shrink-0 bg-black/10">
                          <img src={noteImage} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-purple-400">
                            {isEn ? 'Photo selected for note' : 'عکس برای یادداشت انتخاب شد'}
                          </p>
                          <p className="text-[10px] text-[var(--text3)]">
                            {isEn ? 'Write a caption below or click send.' : 'در کادر زیر کپشن بنویسید یا دکمه ارسال را بزنید.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNoteImage(null)}
                          className="p-1 rounded-lg text-[var(--text3)] hover:text-red-500 transition cursor-pointer shrink-0"
                          title={isEn ? 'Remove photo' : 'حذف عکس'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Inline Link Input */}
                    {showLinkInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-2.5 rounded-2xl bg-[var(--card-bg)] border border-emerald-500/30 flex items-center gap-2"
                      >
                        <Link2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <input
                          type="url"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmAddLink();
                          }}
                          placeholder="https://example.com"
                          dir="ltr"
                          autoFocus
                          className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleConfirmAddLink}
                          disabled={!newLinkUrl.trim()}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer shrink-0"
                        >
                          {isEn ? 'Add' : 'ثبت لینک'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowLinkInput(false);
                            setNewLinkUrl('');
                          }}
                          className="p-1.5 rounded-xl text-[var(--text3)] hover:text-[var(--text)] transition cursor-pointer shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}

                    {/* Chat Action Bar */}
                    <div className="flex items-center gap-2">
                      {/* Photo Button */}
                      <button
                        type="button"
                        onClick={() => noteImageInputRef.current?.click()}
                        className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 active:scale-95 ${
                          noteImage
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : 'bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)] border-[var(--border)] text-[var(--text2)] hover:text-purple-400'
                        }`}
                        title={isEn ? 'Attach photo' : 'انتخاب عکس'}
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>

                      {/* Add Link Button */}
                      <button
                        type="button"
                        onClick={() => setShowLinkInput(!showLinkInput)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 active:scale-95 ${
                          showLinkInput
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : 'bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)] border-[var(--border)] text-[var(--text2)] hover:text-emerald-500'
                        }`}
                        title={isEn ? 'Add Link' : 'افزودن لینک'}
                      >
                        <Link2 className="w-4 h-4" />
                      </button>

                      {/* Add File Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-[var(--text2)] hover:text-purple-500 transition cursor-pointer shrink-0 active:scale-95"
                        title={isEn ? 'Add File' : 'افزودن فایل'}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      {/* Text Input */}
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendNote();
                          }
                        }}
                        placeholder={
                          noteImage
                            ? (isEn ? 'Write a caption for this photo...' : 'کپشن / توضیح عکس را بنویسید...')
                            : (isEn ? 'Write a note or attach photo...' : 'نوشتن یادداشت یا انتخاب عکس...')
                        }
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] focus:border-purple-500 text-xs text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none transition"
                      />

                      {/* Send Button */}
                      <button
                        type="button"
                        onClick={handleSendNote}
                        disabled={!noteText.trim() && !noteImage}
                        className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                      >
                        <span>{isEn ? 'Send' : 'ارسال'}</span>
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[var(--border)] bg-white/30 dark:bg-slate-900/30 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(isEn ? 'Are you sure you want to delete this idea?' : 'آیا از حذف این ایده مطمئن هستید؟')) {
                      onDeleteIdea(activeIdea.id);
                      setActiveIdeaId(null);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-500 hover:bg-red-500/10 text-xs font-bold transition cursor-pointer press-feedback"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isEn ? 'Delete Idea' : 'حذف ایده'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveIdeaId(null);
                    setShowLinkInput(false);
                    setNoteImage(null);
                    setNoteText('');
                  }}
                  className="px-5 py-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-black text-[var(--text)] transition cursor-pointer press-feedback"
                >
                  {isEn ? 'Close' : 'بستن'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
