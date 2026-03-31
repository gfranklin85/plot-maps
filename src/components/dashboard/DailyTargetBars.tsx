'use client';

import { useState } from 'react';
import { DailyTarget } from '@/types';
import { cn } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  targets: DailyTarget;
  onUpdate: (field: string, value: number) => void;
}

interface BarConfig {
  label: string;
  actualKey: keyof DailyTarget;
  targetKey: keyof DailyTarget;
  color: string;
  bgColor: string;
  icon: string;
}

const BARS: BarConfig[] = [
  {
    label: 'Conversations',
    actualKey: 'conversations_actual',
    targetKey: 'conversations_target',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100',
    icon: 'chat',
  },
  {
    label: 'Follow-ups',
    actualKey: 'followups_actual',
    targetKey: 'followups_target',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-100',
    icon: 'replay',
  },
  {
    label: 'Letters',
    actualKey: 'letters_actual',
    targetKey: 'letters_target',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-100',
    icon: 'mail',
  },
  {
    label: 'New Contacts',
    actualKey: 'new_contacts_actual',
    targetKey: 'new_contacts_target',
    color: 'bg-violet-500',
    bgColor: 'bg-violet-100',
    icon: 'person_add',
  },
];

export default function DailyTargetBars({ targets, onUpdate }: Props) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function startEdit(field: string, currentValue: number) {
    setEditingField(field);
    setEditValue(String(currentValue));
  }

  function commitEdit(field: string) {
    const parsed = parseInt(editValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdate(field, parsed);
    }
    setEditingField(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {BARS.map((bar) => {
        const actual = targets[bar.actualKey] as number;
        const target = targets[bar.targetKey] as number;
        const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
        const met = actual >= target && target > 0;

        return (
          <div
            key={bar.label}
            className="rounded-2xl bg-surface-container-lowest p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    bar.bgColor
                  )}
                >
                  <MaterialIcon icon={bar.icon} className="text-[16px]" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {bar.label}
                </span>
              </div>
              {met && (
                <MaterialIcon
                  icon="check_circle"
                  className="text-[20px] text-emerald-500"
                  filled
                />
              )}
            </div>

            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-headline text-2xl font-extrabold text-on-surface">
                {actual}
              </span>
              <span className="text-sm text-secondary">/</span>
              {editingField === bar.targetKey ? (
                <input
                  type="number"
                  min={0}
                  className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(bar.targetKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(bar.targetKey);
                    if (e.key === 'Escape') setEditingField(null);
                  }}
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => startEdit(bar.targetKey, target)}
                  className="text-sm font-bold text-secondary hover:text-primary transition-colors cursor-pointer"
                  title="Click to edit target"
                >
                  {target}
                </button>
              )}
            </div>

            <div className={cn('h-2.5 w-full rounded-full', bar.bgColor)}>
              <div
                className={cn('h-2.5 rounded-full transition-all duration-500', bar.color)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
