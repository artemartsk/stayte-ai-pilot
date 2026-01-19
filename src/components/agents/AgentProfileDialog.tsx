import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AgentProfileDialogProps {
    agentId: string;
    agentName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const LANGUAGE_OPTIONS = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'pl', name: 'Polish' },
    { code: 'ru', name: 'Russian' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'nl', name: 'Dutch' },
    { code: 'sv', name: 'Swedish' },
    { code: 'no', name: 'Norwegian' },
    { code: 'ar', name: 'Arabic' },
    { code: 'zh', name: 'Chinese' },
];

const SPECIALIZATION_OPTIONS = [
    { id: 'luxury', name: 'Luxury' },
    { id: 'investment', name: 'Investment' },
    { id: 'new_builds', name: 'New Builds' },
    { id: 'resale', name: 'Resale' },
    { id: 'commercial', name: 'Commercial' },
    { id: 'rentals', name: 'Rentals' },
];

const SEGMENT_OPTIONS = [
    { id: 'hot_buyer', name: 'Hot' },
    { id: 'qualified', name: 'Qualified' },
    { id: 'warm', name: 'Warm' },
    { id: 'cold', name: 'Cold' },
];

export function AgentProfileDialog({ agentId, agentName, open, onOpenChange }: AgentProfileDialogProps) {
    const queryClient = useQueryClient();
    const [localData, setLocalData] = useState<any>(null);

    const { data: profile, isLoading } = useQuery({
        queryKey: ['agent-profile', agentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('languages, specializations, experience_years, bio, target_segments, max_active_leads, available_for_assignment')
                .eq('id', agentId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: open && !!agentId,
    });

    if (profile && !localData) {
        setLocalData({
            languages: profile.languages || [],
            specializations: profile.specializations || [],
            experience_years: profile.experience_years || 0,
            bio: profile.bio || '',
            target_segments: profile.target_segments || [],
            max_active_leads: profile.max_active_leads || 20,
            available_for_assignment: profile.available_for_assignment ?? true,
        });
    }

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            const { error } = await supabase
                .from('profiles')
                .update(data)
                .eq('id', agentId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent-profile', agentId] });
            queryClient.invalidateQueries({ queryKey: ['agents-dashboard'] });
            toast.success('Profile updated');
            onOpenChange(false);
            setLocalData(null);
        },
        onError: (error: any) => {
            toast.error('Failed to update: ' + error.message);
        }
    });

    const toggleArrayItem = (field: string, item: string) => {
        if (!localData) return;
        const current = localData[field] || [];
        const newValue = current.includes(item)
            ? current.filter((i: string) => i !== item)
            : [...current, item];
        setLocalData({ ...localData, [field]: newValue });
    };

    const handleSave = () => {
        if (!localData) return;
        mutation.mutate(localData);
    };

    const handleClose = () => {
        setLocalData(null);
        onOpenChange(false);
    };

    if (isLoading || !localData) {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="max-w-md p-0 gap-0 border-0 shadow-lg">
                    <div className="animate-pulse p-6 space-y-3">
                        <div className="h-4 bg-slate-100 rounded w-1/3" />
                        <div className="h-16 bg-slate-50 rounded" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md p-0 gap-0 border-0 shadow-lg max-h-[85vh] overflow-hidden">
                {/* Header - Notion style */}
                <div className="px-5 pt-5 pb-3">
                    <h2 className="text-[15px] font-medium text-slate-800">{agentName}</h2>
                    <p className="text-[13px] text-slate-400">Profile settings</p>
                </div>

                <div className="px-5 pb-5 space-y-5 overflow-y-auto max-h-[60vh]">
                    {/* Languages - Notion tag style */}
                    <div className="space-y-2">
                        <p className="text-[12px] text-slate-400 uppercase tracking-wide">Languages</p>
                        <div className="flex flex-wrap gap-1">
                            {LANGUAGE_OPTIONS.map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => toggleArrayItem('languages', lang.code)}
                                    className={`px-2 py-0.5 text-[12px] rounded transition-colors ${localData.languages.includes(lang.code)
                                            ? 'bg-slate-200 text-slate-700'
                                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                        }`}
                                >
                                    {lang.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Specializations */}
                    <div className="space-y-2">
                        <p className="text-[12px] text-slate-400 uppercase tracking-wide">Specializations</p>
                        <div className="flex flex-wrap gap-1">
                            {SPECIALIZATION_OPTIONS.map(spec => (
                                <button
                                    key={spec.id}
                                    onClick={() => toggleArrayItem('specializations', spec.id)}
                                    className={`px-2 py-0.5 text-[12px] rounded transition-colors ${localData.specializations.includes(spec.id)
                                            ? 'bg-slate-200 text-slate-700'
                                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                        }`}
                                >
                                    {spec.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Segments */}
                    <div className="space-y-2">
                        <p className="text-[12px] text-slate-400 uppercase tracking-wide">Target Segments</p>
                        <div className="flex flex-wrap gap-1">
                            {SEGMENT_OPTIONS.map(seg => (
                                <button
                                    key={seg.id}
                                    onClick={() => toggleArrayItem('target_segments', seg.id)}
                                    className={`px-2 py-0.5 text-[12px] rounded transition-colors ${localData.target_segments.includes(seg.id)
                                            ? 'bg-slate-200 text-slate-700'
                                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                        }`}
                                >
                                    {seg.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Numbers row */}
                    <div className="flex gap-4">
                        <div className="flex-1 space-y-1">
                            <p className="text-[12px] text-slate-400 uppercase tracking-wide">Experience</p>
                            <Input
                                type="number"
                                min="0"
                                value={localData.experience_years}
                                onChange={(e) => setLocalData({ ...localData, experience_years: parseInt(e.target.value) || 0 })}
                                className="h-8 text-[13px] border-slate-200 focus:border-slate-300 focus:ring-0"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-[12px] text-slate-400 uppercase tracking-wide">Max Leads</p>
                            <Input
                                type="number"
                                min="1"
                                value={localData.max_active_leads}
                                onChange={(e) => setLocalData({ ...localData, max_active_leads: parseInt(e.target.value) || 20 })}
                                className="h-8 text-[13px] border-slate-200 focus:border-slate-300 focus:ring-0"
                            />
                        </div>
                    </div>

                    {/* Bio */}
                    <div className="space-y-1">
                        <p className="text-[12px] text-slate-400 uppercase tracking-wide">Bio</p>
                        <Textarea
                            value={localData.bio}
                            onChange={(e) => setLocalData({ ...localData, bio: e.target.value })}
                            placeholder="Brief description..."
                            rows={2}
                            className="resize-none text-[13px] border-slate-200 focus:border-slate-300 focus:ring-0"
                        />
                    </div>

                    {/* Available toggle - Notion style row */}
                    <div
                        onClick={() => setLocalData({ ...localData, available_for_assignment: !localData.available_for_assignment })}
                        className="flex items-center justify-between px-2 py-2 rounded cursor-pointer hover:bg-slate-50 -mx-2"
                    >
                        <div>
                            <p className="text-[13px] text-slate-700">Available for auto-assignment</p>
                            <p className="text-[11px] text-slate-400">Receive leads from smart distribution</p>
                        </div>
                        <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${localData.available_for_assignment
                                    ? 'border-slate-400 bg-slate-100'
                                    : 'border-slate-300'
                                }`}
                        >
                            {localData.available_for_assignment && (
                                <svg className="w-2 h-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
                    <button
                        onClick={handleClose}
                        className="px-3 py-1.5 text-[13px] text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={mutation.isPending}
                        className="px-3 py-1.5 text-[13px] bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        {mutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
