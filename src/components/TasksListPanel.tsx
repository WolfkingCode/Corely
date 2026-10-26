import { useState, useMemo } from 'react';
import { Plus, Trash2, ListTodo, Flame, Zap, Circle, CheckCircle2 } from 'lucide-react';
import { AppSettings, TaskItem } from '../types';

interface TasksListPanelProps {
  todos: TaskItem[];
  onAddTask: (type: 'todos' | 'shopping', text: string, priority?: 'urgent' | 'important' | 'normal', category?: string, quantity?: number, unit?: string) => void;
  onToggleTask: (type: 'todos' | 'shopping', idx: number) => void;
  onDeleteTask: (type: 'todos' | 'shopping', idx: number) => void;
  settings?: AppSettings;
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, important: 1, normal: 2 };

export default function TasksListPanel({ todos, onAddTask, onToggleTask, onDeleteTask, settings }: TasksListPanelProps) {
  const isEn = settings?.language === 'en';
  const [newText, setNewText] = useState('');
  const [newPriority, setNewPriority] = useState<'urgent' | 'important' | 'normal'>('normal');

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAddTask('todos', trimmed, newPriority);
    setNewText('');
    setNewPriority('normal');
  };

  // Sort: incomplete first (by priority), then completed at the bottom
  const sortedWithIdx = useMemo(() => {
    return todos
      .map((item, idx) => ({ item, idx }))
      .sort((a, b) => {
        if (a.item.done !== b.item.done) return a.item.done ? 1 : -1;
        const pa = PRIORITY_ORDER[a.item.priority || 'normal'];
        const pb = PRIORITY_ORDER[b.item.priority || 'normal'];
        return pa - pb;
      });
  }, [todos]);

  const doneCount = todos.filter(t => t.done).length;

  const priorityDot = (p?: 'urgent' | 'important' | 'normal') => {
    if (p === 'urgent') return <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    if (p === 'important') return <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    return null;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
            <ListTodo className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-[var(--text)]">{isEn ? 'Tasks' : 'کارها'}</h2>
            <p className="text-[11px] text-[var(--text3)]">
              {isEn ? `${doneCount} of ${todos.length} done` : `${doneCount} از ${todos.length} انجامشده`}
            </p>
          </div>
        </div>
      </div>

      {/* Add new task */}
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={isEn ? 'Add a task...' : 'یه کار اضافه کن...'}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text3)]"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-500 to-purple-600 text-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1.5">
          {(['normal', 'important', 'urgent'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setNewPriority(p)}
              className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                newPriority === p
                  ? p === 'urgent'
                    ? 'bg-rose-500 text-white'
                    : p === 'important'
                    ? 'bg-amber-500 text-white'
                    : 'bg-violet-500 text-white'
                  : 'bg-[var(--sidebar-hover)] text-[var(--text2)]'
              }`}
            >
              {p === 'urgent' && <Flame className="w-3 h-3" />}
              {p === 'important' && <Zap className="w-3 h-3" />}
              {p === 'urgent' ? (isEn ? 'Urgent' : 'ضروری') : p === 'important' ? (isEn ? 'Important' : 'مهم') : (isEn ? 'Normal' : 'عادی')}
            </button>
          ))}
        </div>
      </div>

      {/* Task list, sorted by priority */}
      {todos.length === 0 ? (
        <div className="text-center py-10 text-[var(--text3)] text-sm">
          {isEn ? 'No tasks yet' : 'هنوز کاری ثبت نشده'}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] divide-y divide-[var(--border)] overflow-hidden">
          {sortedWithIdx.map(({ item, idx }) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3.5">
              <button
                type="button"
                onClick={() => onToggleTask('todos', idx)}
                className="shrink-0 cursor-pointer"
              >
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-violet-500" />
                ) : (
                  <Circle className="w-5 h-5 text-[var(--text3)]" />
                )}
              </button>
              {priorityDot(item.priority)}
              <span className={`flex-1 text-sm ${item.done ? 'line-through text-[var(--text3)]' : 'text-[var(--text)]'}`}>
                {item.text}
              </span>
              {item.category && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--sidebar-hover)] text-[var(--text3)] shrink-0">
                  {item.category}
                </span>
              )}
              <button
                type="button"
                onClick={() => onDeleteTask('todos', idx)}
                className="text-[var(--text3)] hover:text-red-400 transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
