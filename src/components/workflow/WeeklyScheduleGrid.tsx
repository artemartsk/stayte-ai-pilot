import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { TimeWindow } from './StepConfiguration';

interface WeeklyScheduleGridProps {
    value?: TimeWindow[];
    onChange: (windows: TimeWindow[]) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7 to 22

export const WeeklyScheduleGrid = ({ value = [], onChange }: WeeklyScheduleGridProps) => {
    // Helper to convert normalized windows back to a grid selection
    // Grid matches if ANY window covers the hour slot
    const isSelected = (dayIdx: number, hour: number) => {
        const dayKey = DAY_KEYS[dayIdx];
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;

        return value.some(w => {
            if (!w.days.includes(dayKey)) return false;
            // Simple logic: if window starts at or before hour AND ends after hour
            // e.g. 09:00-10:00 covers 09:00 slot.
            // But we treat slot as the full hour 9-10.
            return w.start <= timeStr && w.end > timeStr;
        });
    };

    const toggleSlot = (dayIdx: number, hour: number, current: boolean) => {
        // We will reconstruct the TimeWindows from scratch based on the toggle state
        // This is a bit brute-force but ensures consistency.

        // 1. Build a map of all currently selected slots
        const selectedMap: { [key: string]: number[] } = {};

        DAY_KEYS.forEach((d, idx) => {
            selectedMap[d] = [];
            HOURS.forEach(h => {
                // If this is the slot being toggled, use new state
                if (idx === dayIdx && h === hour) {
                    if (!current) selectedMap[d].push(h);
                } else {
                    // Otherwise check existing windows
                    if (isSelected(idx, h)) selectedMap[d].push(h);
                }
            });
            selectedMap[d].sort((a, b) => a - b);
        });

        // 2. Convert map to merged TimeWindows
        const newWindows: TimeWindow[] = [];

        DAY_KEYS.forEach(day => {
            const hours = selectedMap[day];
            if (hours.length === 0) return;

            let start = hours[0];
            let prev = hours[0];

            for (let i = 1; i < hours.length; i++) {
                if (hours[i] === prev + 1) {
                    // continuous
                    prev = hours[i];
                } else {
                    // break, push window
                    newWindows.push({
                        start: `${start.toString().padStart(2, '0')}:00`,
                        end: `${(prev + 1).toString().padStart(2, '0')}:00`,
                        days: [day]
                    });
                    start = hours[i];
                    prev = hours[i];
                }
            }
            // push last window
            newWindows.push({
                start: `${start.toString().padStart(2, '0')}:00`,
                end: `${(prev + 1).toString().padStart(2, '0')}:00`,
                days: [day]
            });
        });

        // 3. (Optional) Merge identical windows across days to clean up?
        // For now, keeping separate days is safer and easier to visualize.
        onChange(newWindows);
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-[32px_repeat(7,1fr)] gap-x-1 gap-y-0.5">
                    {/* Header Row */}
                    <div className="h-6"></div>
                    {DAYS.map(day => (
                        <div key={day} className="flex items-center justify-center text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide h-6">
                            {day}
                        </div>
                    ))}

                    {/* Time Rows */}
                    {HOURS.map((hour, hourIdx) => (
                        <>
                            {/* Time Label */}
                            <div key={`label-${hour}`} className="flex items-start justify-end pr-2 pt-[2px] text-[10px] text-muted-foreground/50 h-8 font-mono">
                                {hour}
                            </div>

                            {/* Slots */}
                            {DAYS.map((_, dayIdx) => {
                                const active = isSelected(dayIdx, hour);
                                return (
                                    <div
                                        key={`slot-${dayIdx}-${hour}`}
                                        onClick={() => toggleSlot(dayIdx, hour, active)}
                                        className={cn(
                                            "h-8 rounded-[3px] cursor-pointer transition-all duration-100 ease-out",
                                            active
                                                ? "bg-slate-300 hover:bg-slate-400"
                                                : "bg-slate-100/80 hover:bg-slate-200/80"
                                        )}
                                        title={`${DAYS[dayIdx]} ${hour}:00`}
                                    />
                                );
                            })}
                        </>
                    ))}
                </div>
            </div>
        </div>
    );
};
