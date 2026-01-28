import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

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
    { code: 'ar', name: 'Arabic' },
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
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: profile, isLoading } = useQuery({
        queryKey: ['agent-profile', agentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, avatar_url, email, phone, languages, specializations, experience_years, bio, target_segments, max_active_leads, available_for_assignment')
                .eq('id', agentId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: open && !!agentId,
    });

    if (profile && !localData) {
        setLocalData({
            full_name: profile.full_name || '',
            avatar_url: profile.avatar_url || '',
            phone: profile.phone || '',
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

    const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB');
            return;
        }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${agentId}/avatar.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('agent-avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('agent-avatars')
                .getPublicUrl(fileName);

            setLocalData({ ...localData, avatar_url: publicUrl });
            toast.success('Avatar uploaded');
        } catch (err: any) {
            toast.error(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    };

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
            <Sheet open={open} onOpenChange={handleClose}>
                <SheetContent className="w-[500px] sm:w-[540px] p-0">
                    <div className="animate-pulse p-6 space-y-4">
                        <div className="h-20 w-20 bg-muted rounded-full" />
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-10 bg-muted rounded" />
                    </div>
                </SheetContent>
            </Sheet>
        );
    }

    const initials = (localData.full_name || agentName || 'A')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <Sheet open={open} onOpenChange={handleClose}>
            <SheetContent className="w-[500px] sm:w-[540px] p-0 overflow-hidden">
                <div className="h-full flex flex-col">
                    {/* Header with Avatar */}
                    <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-4">
                            {localData.avatar_url ? (
                                <div className="relative group">
                                    <img
                                        src={localData.avatar_url}
                                        alt="Avatar"
                                        className="w-16 h-16 rounded-full object-cover"
                                    />
                                    <button
                                        onClick={() => setLocalData({ ...localData, avatar_url: '' })}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center text-lg font-semibold">
                                    {initials}
                                </div>
                            )}
                            <div>
                                <h2 className="text-[17px] font-semibold text-foreground">{localData.full_name || agentName}</h2>
                                <p className="text-[13px] text-muted-foreground">{profile?.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Avatar Upload */}
                        <div className="space-y-2">
                            <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Avatar</label>
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
                                    ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}
                                `}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                    className="hidden"
                                />
                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                    <Upload className="w-4 h-4" />
                                    <span className="text-[13px]">{isUploading ? 'Uploading...' : 'Drop image or click'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Full Name */}
                        <div className="space-y-2">
                            <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Full Name</label>
                            <Input
                                value={localData.full_name}
                                onChange={(e) => setLocalData({ ...localData, full_name: e.target.value })}
                                placeholder="John Smith"
                                className="h-10 text-[14px]"
                            />
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Phone</label>
                            <Input
                                value={localData.phone}
                                onChange={(e) => setLocalData({ ...localData, phone: e.target.value })}
                                placeholder="+34 600 123 456"
                                className="h-10 text-[14px]"
                            />
                        </div>

                        {/* Languages */}
                        <div className="space-y-2">
                            <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Languages</label>
                            <div className="flex flex-wrap gap-1.5">
                                {LANGUAGE_OPTIONS.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => toggleArrayItem('languages', lang.code)}
                                        className={`px-2.5 py-1 text-[12px] rounded-md transition-colors ${localData.languages.includes(lang.code)
                                                ? 'bg-primary/10 text-primary border border-primary/20'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                            }`}
                                    >
                                        {lang.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Specializations */}
                        <div className="space-y-2">
                            <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Specializations</label>
                            <div className="flex flex-wrap gap-1.5">
                                {SPECIALIZATION_OPTIONS.map(spec => (
                                    <button
                                        key={spec.id}
                                        onClick={() => toggleArrayItem('specializations', spec.id)}
                                        className={`px-2.5 py-1 text-[12px] rounded-md transition-colors ${localData.specializations.includes(spec.id)
                                                ? 'bg-primary/10 text-primary border border-primary/20'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                            }`}
                                    >
                                        {spec.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Target Segments */}
                        <div className="space-y-2">
                            <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Target Segments</label>
                            <div className="flex flex-wrap gap-1.5">
                                {SEGMENT_OPTIONS.map(seg => (
                                    <button
                                        key={seg.id}
                                        onClick={() => toggleArrayItem('target_segments', seg.id)}
                                        className={`px-2.5 py-1 text-[12px] rounded-md transition-colors ${localData.target_segments.includes(seg.id)
                                                ? 'bg-primary/10 text-primary border border-primary/20'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                            }`}
                                    >
                                        {seg.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Numbers row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Experience (years)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={localData.experience_years}
                                    onChange={(e) => setLocalData({ ...localData, experience_years: parseInt(e.target.value) || 0 })}
                                    className="h-10 text-[14px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Max Active Leads</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={localData.max_active_leads}
                                    onChange={(e) => setLocalData({ ...localData, max_active_leads: parseInt(e.target.value) || 20 })}
                                    className="h-10 text-[14px]"
                                />
                            </div>
                        </div>

                        {/* Bio */}
                        <div className="space-y-2">
                            <label className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Bio</label>
                            <Textarea
                                value={localData.bio}
                                onChange={(e) => setLocalData({ ...localData, bio: e.target.value })}
                                placeholder="Brief description about yourself..."
                                rows={3}
                                className="resize-none text-[14px]"
                            />
                        </div>

                        {/* Available toggle */}
                        <div
                            onClick={() => setLocalData({ ...localData, available_for_assignment: !localData.available_for_assignment })}
                            className="flex items-center justify-between p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                            <div>
                                <p className="text-[14px] font-medium text-foreground">Available for auto-assignment</p>
                                <p className="text-[12px] text-muted-foreground">Receive leads from smart distribution</p>
                            </div>
                            <div className={`w-10 h-6 rounded-full transition-colors ${localData.available_for_assignment ? 'bg-primary' : 'bg-muted'}`}>
                                <div className={`w-5 h-5 mt-0.5 rounded-full bg-white shadow transition-transform ${localData.available_for_assignment ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 p-4 border-t border-border bg-background">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={mutation.isPending}
                            className="px-4 py-2 text-[13px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {mutation.isPending ? 'Saving...' : 'Save changes'}
                        </button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
