import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Mail, MessageSquare, UserCog, AlertCircle, GitBranch, Flame, Settings2, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from '@/contexts/AuthContext';

export type TimeWindow = {
    start: string;
    end: string;
    days: string[];
};

export type Intervention = {
    attempt: number;
    action: 'send_email' | 'send_whatsapp' | 'update_contact';
    templateId?: string;
    fields?: Record<string, any>;
};

export type RetryConfig = {
    maxAttempts: number;
    backoff: 'smart_morning_evening' | 'fixed_24h';
    interventions: Intervention[];
    oneCallPerWindow?: boolean;
};

export type WhatsAppConfig = {
    templateId?: string;
    variables?: Record<string, string>;
    message?: string;
    forceImmediate?: boolean;
    enableAi?: boolean;
    agentPrompt?: string;
    timeoutMinutes?: number;
    extractInsights?: boolean;
};

export type CallConfig = {
    voiceId: string;
    prompt: string;
    language: string;
    phoneNumber: string;
    retryConfig?: RetryConfig;
};

export type SwitchConfig = {
    field: string;
    outputs: { id: string; name: string; color: string }[];
};

export type AssignAgentConfig = {
    strategy: 'least_leads' | 'always_admin' | 'smart';
    adminId?: string;
};

export type NurtureConfig = {
    propertyCount: number;
    includeAgentIntro: boolean;
};

interface NurtureInputProps {
    value?: NurtureConfig;
    onChange: (value: NurtureConfig) => void;
}

export const NurtureInput = ({ value, onChange }: NurtureInputProps) => {
    return (
        <div className="space-y-6">
            <div className="space-y-1 pt-2">
                {/* Property Count Row */}
                <div className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md hover:bg-muted/40 group transition-colors">
                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <Plus className="h-4 w-4 opacity-70" />
                        <span>Properties count</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min="1"
                            max="10"
                            className="w-16 h-7 text-right text-sm border-transparent bg-transparent hover:bg-background hover:border-input focus:border-input focus:bg-background transition-all shadow-none p-1"
                            value={value?.propertyCount || 3}
                            onChange={(e) => onChange({ ...value, propertyCount: parseInt(e.target.value) || 3 })}
                        />
                    </div>
                </div>

                {/* Agent Intro Row */}
                <div className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md hover:bg-muted/40 group transition-colors">
                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <UserCog className="h-4 w-4 opacity-70" />
                        <span>Agent introduction</span>
                    </div>
                    <Switch
                        className="scale-90"
                        checked={value?.includeAgentIntro !== false}
                        onCheckedChange={(c) => onChange({ ...value, includeAgentIntro: c })}
                    />
                </div>
            </div>

            {/* Hint / Footer */}
            <div className="p-3 bg-muted/20 rounded-md border border-transparent mx-1">
                <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground leading-tight">
                        This workflow step will query the database for "Active" Listings that match the contact's preferences and have <strong>not</strong> been sent to them before.
                    </p>
                </div>
            </div>
        </div>
    );
};

interface TimeWindowInputProps {
    value?: TimeWindow[];
    onChange: (value: TimeWindow[]) => void;
}

export const TimeWindowInput = ({ value = [], onChange }: TimeWindowInputProps) => {
    const addWindow = () => {
        onChange([
            ...value,
            { start: '09:00', end: '18:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'] }
        ]);
    };

    const removeWindow = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    const updateWindow = (index: number, field: keyof TimeWindow, val: any) => {
        const newWindows = [...value];
        newWindows[index] = { ...newWindows[index], [field]: val };
        onChange(newWindows);
    };

    return (
        <div className="space-y-4 p-4 border rounded-md bg-muted/20">
            <div className="flex items-center justify-between">
                <Label className="font-semibold">Time Windows</Label>
                <Button variant="ghost" size="sm" onClick={addWindow} className="h-8 px-2">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                </Button>
            </div>

            {value.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">
                    No time windows set (always active)
                </div>
            )}

            {value.map((window, index) => (
                <div key={index} className="grid gap-2 p-3 bg-background rounded border relative group">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -right-2 -top-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => removeWindow(index)}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label htmlFor={`start-${index}`} className="text-[10px] uppercase text-muted-foreground">Start</Label>
                            <Input
                                id={`start-${index}`}
                                type="time"
                                className="h-8"
                                value={window.start}
                                onChange={(e) => updateWindow(index, 'start', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor={`end-${index}`} className="text-[10px] uppercase text-muted-foreground">End</Label>
                            <Input
                                id={`end-${index}`}
                                type="time"
                                className="h-8"
                                value={window.end}
                                onChange={(e) => updateWindow(index, 'end', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

interface WhatsAppInputProps {
    value?: WhatsAppConfig;
    onChange: (value: WhatsAppConfig) => void;
}

export const WhatsAppInput = ({ value, onChange }: WhatsAppInputProps) => {
    // Mode: 'template' | 'custom'
    // We infer mode from value: if templateId is set -> template, else -> custom
    const mode = value?.templateId ? 'template' : 'custom';

    const { data: templates = [], isLoading } = useQuery({
        queryKey: ['twilio-templates'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('get-twilio-templates');
            if (error) throw error;
            return data.templates || [];
        }
    });

    const handleModeChange = (newMode: 'template' | 'custom') => {
        if (newMode === 'template') {
            // Pick first template or keep existing
            onChange({ ...value, templateId: templates[0]?.sid || '', message: undefined });
        } else {
            // Clear templateId
            onChange({ ...value, templateId: undefined, message: '' });
        }
    };

    return (
        <div className="space-y-4 p-4 border rounded-md bg-muted/20">
            <div className="space-y-2">
                <Label>Message Type</Label>
                <RadioGroup
                    value={mode}
                    onValueChange={(v) => handleModeChange(v as 'template' | 'custom')}
                    className="flex flex-row gap-4"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="template" id="m-template" />
                        <Label htmlFor="m-template" className="font-normal">Template</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom" id="m-custom" />
                        <Label htmlFor="m-custom" className="font-normal">Custom Text</Label>
                    </div>
                </RadioGroup>
            </div>

            {mode === 'template' ? (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Select Template</Label>
                        <Select
                            value={value?.templateId}
                            onValueChange={(val) => {
                                // Reset variables when template changes
                                onChange({ ...value, templateId: val, variables: {} });
                            }}
                            disabled={isLoading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={isLoading ? "Loading..." : "Select a template"} />
                            </SelectTrigger>
                            <SelectContent>
                                {templates.map((t: any) => (
                                    <SelectItem key={t.sid} value={t.sid}>
                                        {t.friendly_name} ({t.language})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Variable Mapping Section */}
                    {value?.templateId && templates.find(t => t.sid === value.templateId)?.variables && (
                        <div className="space-y-3 p-3 bg-background rounded border border-dashed">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                                <UserCog className="h-3 w-3" />
                                Variable Mapping
                            </Label>
                            <div className="space-y-3">
                                {Object.entries(templates.find(t => t.sid === value.templateId).variables).map(([varKey, varDesc]: [string, any]) => (
                                    <div key={varKey} className="grid grid-cols-2 gap-2 items-center">
                                        <div className="text-xs font-medium">
                                            {"{{"}{varKey}{"}}"}
                                            <span className="text-[10px] text-muted-foreground block truncate">
                                                {typeof varDesc === 'string' ? varDesc : 'Dynamic value'}
                                            </span>
                                        </div>
                                        <Select
                                            value={value.variables?.[varKey] || ''}
                                            onValueChange={(field) => onChange({
                                                ...value,
                                                variables: { ...(value.variables || {}), [varKey]: field }
                                            })}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Select field..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="first_name">First Name</SelectItem>
                                                <SelectItem value="last_name">Last Name</SelectItem>
                                                <SelectItem value="email">Email</SelectItem>
                                                <SelectItem value="phone">Phone</SelectItem>
                                                <SelectItem value="budget">Budget</SelectItem>
                                                <SelectItem value="location_preferences">Location</SelectItem>
                                                <SelectItem value="custom_static">Static Text...</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {value.variables?.[varKey] === 'custom_static' && (
                                            <div className="col-span-2 pt-1">
                                                <Input
                                                    placeholder="Enter static text..."
                                                    className="h-7 text-xs"
                                                    value={value.variables?.[`${varKey}_static`] || ''}
                                                    onChange={(e) => onChange({
                                                        ...value,
                                                        variables: { ...(value.variables || {}), [`${varKey}_static`]: e.target.value }
                                                    })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    <Label>Message Body</Label>
                    <Textarea
                        value={value?.message || ''}
                        onChange={(e) => onChange({ ...value, message: e.target.value })}
                        placeholder="Hello, this is a message..."
                        className="min-h-[100px]"
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Use for responses within 24h window.
                    </p>
                </div>
            )}

            <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Force Immediate Send</Label>
                        <p className="text-[10px] text-muted-foreground">
                            Ignore Time Windows for this message (send 24/7)
                        </p>
                    </div>
                    <Switch
                        checked={value?.forceImmediate || false}
                        onCheckedChange={(c) => onChange({ ...value, forceImmediate: c })}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Enable AI Auto-Reply</Label>
                        <p className="text-[10px] text-muted-foreground">
                            AI Agent will handle subsequent replies
                        </p>
                    </div>
                    <Switch
                        checked={value?.enableAi || false}
                        onCheckedChange={(c) => onChange({ ...value, enableAi: c })}
                    />
                </div>

                {value?.enableAi && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <Label className="text-xs">AI Agent Prompt Override (Optional)</Label>
                        <Textarea
                            placeholder="Overwrite global prompt for this workflow..."
                            value={value?.agentPrompt || ''}
                            onChange={(e) => onChange({ ...value, agentPrompt: e.target.value })}
                            className="min-h-[100px] text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Leave empty to use the Global AI Agent Prompt.
                        </p>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>AI Insight Extraction</Label>
                        <p className="text-[10px] text-muted-foreground">
                            Automatically update contact from chat insights
                        </p>
                    </div>
                    <Switch
                        checked={value?.extractInsights || false}
                        onCheckedChange={(c) => onChange({ ...value, extractInsights: c })}
                    />
                </div>

                <div className="pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs h-8 border-dashed hover:border-green-500 hover:text-green-600 hover:bg-green-50"
                        onClick={async () => {
                            const testPhone = window.prompt("Enter phone number to send test WhatsApp (e.g. +34600000000):");
                            if (!testPhone) return;

                            try {
                                // Resolve variables for test
                                const resolvedVars: Record<string, string> = {};
                                if (value?.variables) {
                                    for (const [vK, vF] of Object.entries(value.variables)) {
                                        if (vK.endsWith('_static')) continue;
                                        if (vF === 'custom_static') {
                                            resolvedVars[vK] = value.variables[`${vK}_static`] || '';
                                        } else {
                                            resolvedVars[vK] = `[${vF}]`; // Placeholder for test
                                        }
                                    }
                                }

                                const { data, error } = await supabase.functions.invoke('test-whatsapp', {
                                    body: {
                                        testPhone,
                                        templateId: value?.templateId,
                                        message: value?.message,
                                        variables: resolvedVars
                                    }
                                });

                                if (error) throw error;
                                alert("Test WhatsApp sent successfully!");
                            } catch (err: any) {
                                console.error(err);
                                alert("Failed to send test: " + err.message);
                            }
                        }}
                    >
                        <MessageSquare className="h-3 w-3" />
                        Send Test WhatsApp
                    </Button>
                </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-dashed">
                <Label>Wait for Reply Timeout (Minutes)</Label>
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 60 (0 = Don't wait)"
                        value={value?.timeoutMinutes || 0}
                        onChange={(e) => onChange({ ...value, timeoutMinutes: parseInt(e.target.value) || 0 })}
                        className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                    If no reply received within this time, the Red path will be followed.
                    Set to 0 to proceed immediately (Green path).
                </p>
            </div>
        </div>
    );
};

interface CallInputProps {
    value?: CallConfig;
    onChange: (value: CallConfig) => void;
}

export const CallInput = ({ value, onChange }: CallInputProps) => {
    const retryConfig = value?.retryConfig || {
        maxAttempts: 1,
        backoff: 'smart_morning_evening',
        interventions: []
    };

    const updateRetry = (field: keyof RetryConfig, val: any) => {
        onChange({
            ...value,
            retryConfig: { ...retryConfig, [field]: val }
        });
    };

    const addIntervention = () => {
        const newIntervention: Intervention = {
            attempt: 2,
            action: 'send_email',
            templateId: 'follow_up_1'
        };
        updateRetry('interventions', [...retryConfig.interventions, newIntervention]);
    };

    const removeIntervention = (index: number) => {
        const newInterventions = [...retryConfig.interventions];
        newInterventions.splice(index, 1);
        updateRetry('interventions', newInterventions);
    };

    const updateIntervention = (index: number, field: keyof Intervention, val: any) => {
        const newInterventions = [...retryConfig.interventions];
        newInterventions[index] = { ...newInterventions[index], [field]: val };
        updateRetry('interventions', newInterventions);
    };

    return (
        <div className="space-y-1">
            {/* Row: Global Settings */}
            <div className="flex items-start gap-4 py-3 border-b border-slate-100">
                <Settings2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                    <p className="text-[13px] font-medium text-slate-700">Global Settings</p>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                        Using agency global Vapi settings (voice, phone number).
                    </p>
                </div>
            </div>

            {/* Row: Smart Retry Logic */}
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
                <RefreshCw className="h-4 w-4 text-slate-400 shrink-0" />
                <p className="text-[13px] text-slate-700 flex-1">Smart Retry Logic</p>
                <Switch
                    checked={retryConfig.maxAttempts > 1}
                    onCheckedChange={(c) => updateRetry('maxAttempts', c ? 3 : 1)}
                />
            </div>

            {retryConfig.maxAttempts > 1 && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                    {/* Row: Max Attempts */}
                    <div className="flex items-center gap-4 py-3 border-b border-slate-100 pl-8">
                        <p className="text-[13px] text-slate-500 flex-1">Max Attempts</p>
                        <Input
                            type="number"
                            min={1}
                            max={10}
                            value={retryConfig.maxAttempts}
                            onChange={(e) => updateRetry('maxAttempts', parseInt(e.target.value))}
                            className="w-16 h-8 text-[13px] text-right border-slate-200"
                        />
                    </div>

                    {/* Row: Interventions */}
                    <div className="py-3 border-b border-slate-100">
                        <div className="flex items-center gap-4 pl-8">
                            <p className="text-[13px] text-slate-500 flex-1">Interventions (Rules)</p>
                            <button
                                onClick={addIntervention}
                                className="text-[12px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Rule
                            </button>
                        </div>

                        {retryConfig.interventions.length === 0 && (
                            <p className="text-[12px] text-slate-400 text-center py-3 pl-8">
                                No rules defined
                            </p>
                        )}

                        <div className="space-y-2 mt-2 pl-8">
                            {retryConfig.interventions.map((rule, idx) => (
                                <div key={idx} className="relative group flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-[12px]">
                                    <span className="text-slate-500">If Attempt #</span>
                                    <Input
                                        type="number"
                                        className="w-12 h-6 text-[12px] text-center border-slate-200"
                                        value={rule.attempt}
                                        onChange={(e) => updateIntervention(idx, 'attempt', parseInt(e.target.value))}
                                    />
                                    <span className="text-slate-500">fails →</span>
                                    <Select
                                        value={rule.action}
                                        onValueChange={(v) => updateIntervention(idx, 'action', v)}
                                    >
                                        <SelectTrigger className="h-6 w-28 text-[11px] border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="send_email">Send Email</SelectItem>
                                            <SelectItem value="send_whatsapp">WhatsApp</SelectItem>
                                            <SelectItem value="update_contact">Update Contact</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <button
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 ml-auto"
                                        onClick={() => removeIntervention(idx)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Row: One call per window */}
                    <div className="flex items-center gap-4 py-3 border-b border-slate-100 pl-8">
                        <div className="flex-1">
                            <p className="text-[13px] text-slate-500">One call per window</p>
                            <p className="text-[11px] text-slate-400">Limit to 1 attempt per active time block</p>
                        </div>
                        <Switch
                            checked={retryConfig.oneCallPerWindow !== false}
                            onCheckedChange={(c) => updateRetry('oneCallPerWindow', c)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// === CONDITION INPUT for check_qualification node (n8n IF style) ===

export type ConditionConfig = {
    conditions: Condition[];
    combineWith: 'and' | 'or';
};

export type Condition = {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than';
    value: string;
};

const CONTACT_FIELDS = [
    { value: 'current_status', label: 'Status' },
    { value: 'lead_score', label: 'Lead Score' },
    { value: 'source', label: 'Source' },
    { value: 'assigned_agent_id', label: 'Assigned Agent' },
    { value: 'tags', label: 'Tags' },
];

const OPERATORS = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
];

const STATUS_OPTIONS = [
    { value: 'hot_buyer', label: 'Hot Buyer' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'warm', label: 'Warm' },
    { value: 'cold', label: 'Cold' },
    { value: 'new', label: 'New Lead' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'nurturing', label: 'Nurturing' },
];

interface ConditionInputProps {
    value?: ConditionConfig;
    onChange: (value: ConditionConfig) => void;
}

export const ConditionInput = ({ value, onChange }: ConditionInputProps) => {
    const config: ConditionConfig = value || { conditions: [{ field: 'current_status', operator: 'equals', value: 'hot_buyer' }], combineWith: 'and' };

    const addCondition = () => {
        onChange({
            ...config,
            conditions: [...config.conditions, { field: 'current_status', operator: 'equals', value: '' }]
        });
    };

    const removeCondition = (index: number) => {
        const newConditions = config.conditions.filter((_, i) => i !== index);
        onChange({ ...config, conditions: newConditions.length > 0 ? newConditions : [{ field: 'current_status', operator: 'equals', value: '' }] });
    };

    const updateCondition = (index: number, field: keyof Condition, val: string) => {
        const newConditions = [...config.conditions];
        newConditions[index] = { ...newConditions[index], [field]: val };
        onChange({ ...config, conditions: newConditions });
    };

    const needsValue = (op: string) => !['is_empty', 'is_not_empty'].includes(op);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="font-semibold text-base">Conditions</Label>
                <Select
                    value={config.combineWith}
                    onValueChange={(v: 'and' | 'or') => onChange({ ...config, combineWith: v })}
                >
                    <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="and">AND</SelectItem>
                        <SelectItem value="or">OR</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <p className="text-xs text-muted-foreground -mt-2">
                If all conditions match → Green path (Qualified). Otherwise → Red path (Not Qualified).
            </p>

            <div className="space-y-3">
                {config.conditions.map((condition, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-muted/20 space-y-3 relative group">
                        {config.conditions.length > 1 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute -right-2 -top-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 bg-destructive text-white hover:bg-destructive/90"
                                onClick={() => removeCondition(index)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}

                        {/* Row 1: Field */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Field</Label>
                            <Select
                                value={condition.field}
                                onValueChange={(v) => updateCondition(index, 'field', v)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select field" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONTACT_FIELDS.map(f => (
                                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Row 2: Operator */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Operator</Label>
                            <Select
                                value={condition.operator}
                                onValueChange={(v) => updateCondition(index, 'operator', v)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select operator" />
                                </SelectTrigger>
                                <SelectContent>
                                    {OPERATORS.map(o => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Row 3: Value (conditional) */}
                        {needsValue(condition.operator) && (
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Value</Label>
                                {condition.field === 'current_status' ? (
                                    <Select
                                        value={condition.value}
                                        onValueChange={(v) => updateCondition(index, 'value', v)}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUS_OPTIONS.map(s => (
                                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        value={condition.value}
                                        onChange={(e) => updateCondition(index, 'value', e.target.value)}
                                        placeholder="Enter value..."
                                        className="h-9"
                                    />
                                )}
                            </div>
                        )}

                        {index < config.conditions.length - 1 && (
                            <div className="flex justify-center -mb-1 mt-2">
                                <Badge variant="outline" className="text-[10px] bg-background">
                                    {config.combineWith.toUpperCase()}
                                </Badge>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Button variant="outline" size="sm" onClick={addCondition} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Condition
            </Button>
        </div>
    );
};

// === SWITCH INPUT for check_qualification node (route by group) ===



// Standard status groups used as fallback if no custom groups exist
// Standard status groups used as fallback if no custom groups exist
export const DEFAULT_STATUS_GROUPS = [
    { id: 'hot_buyer', name: 'Hot Buyer', color: '#ef4444' }, // red-500
];

const defaultOutput = { id: 'default', name: 'Default', color: '#94a3b8' };

interface SwitchInputProps {
    value?: SwitchConfig;
    onChange: (value: SwitchConfig) => void;
}

export const SwitchInput = ({ value, onChange }: SwitchInputProps) => {
    const { user } = useAuth();

    // Use query for groups to stay in sync with GroupsManager
    const { data: dbGroups = [], isLoading } = useQuery({
        queryKey: ['contact-groups', user?.agency_id],
        queryFn: async () => {
            if (!user?.agency_id) return [];
            const { data, error } = await supabase
                .from('contact_groups')
                .select('id, name, color')
                .eq('agency_id', user.agency_id)
                .order('name');
            if (error) throw error;
            return data || [];
        },
        enabled: !!user?.agency_id
    });

    // Normalize value to handle legacy string outputs
    const normalizeOutputs = (outputs: any[]): { id: string; name: string; color: string }[] => {
        if (!outputs || outputs.length === 0) return [];
        return outputs.map(o => {
            if (typeof o === 'string') {
                return {
                    id: o,
                    name: o.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    color: '#94a3b8'
                };
            }
            return o;
        });
    };

    const config: SwitchConfig = {
        field: value?.field || 'group_id',
        outputs: normalizeOutputs(value?.outputs || [])
    };

    // Unified list of groups to display
    const allGroups = (() => {
        // If we have custom groups in DB, show them
        if (dbGroups.length > 0) {
            return [...dbGroups];
        }

        // Otherwise show standard status groups (matching CustomNode fallback)
        return DEFAULT_STATUS_GROUPS;
    })();

    const toggleGroup = (group: { id: string; name: string; color: string }) => {
        const current = config.outputs || [];
        const exists = current.find(o => o.id === group.id);

        if (exists) {
            // Remove (don't allow removing if it's the only one left)
            if (current.length > 1) {
                onChange({ ...config, outputs: current.filter(o => o.id !== group.id) });
            }
        } else {
            // Add
            onChange({ ...config, outputs: [...current, group] });
        }
    };

    const isSelected = (groupId: string) => (config.outputs || []).some(o => o.id === groupId);

    if (isLoading && dbGroups.length === 0) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/3" />
                <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg border" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 text-[13px] text-slate-400">
                <GitBranch className="h-3.5 w-3.5" />
                <span>Route contacts by group membership</span>
            </div>

            {/* Groups list */}
            <div className="space-y-0">
                {allGroups.map((group) => {
                    const selected = isSelected(group.id);
                    return (
                        <div
                            key={group.id}
                            className={`
                                flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer
                                transition-colors hover:bg-slate-50
                                ${selected ? 'bg-slate-50' : ''}
                            `}
                            onClick={() => toggleGroup(group)}
                        >
                            {/* Checkbox - thin and subtle */}
                            <div
                                className={`
                                    w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0
                                    ${selected
                                        ? 'border-slate-400 bg-slate-100'
                                        : 'border-slate-300'
                                    }
                                `}
                            >
                                {selected && (
                                    <svg className="w-2 h-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>

                            {/* Color dot + name */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: group.color }}
                                />
                                <span className={`text-[13px] truncate ${selected ? 'text-slate-700' : 'text-slate-500'}`}>
                                    {group.name}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Output count - subtle */}
            {config.outputs.length > 0 && (
                <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-slate-400">
                            {config.outputs.length} output{config.outputs.length > 1 ? 's' : ''}:
                        </span>
                        {config.outputs.map((output, i) => (
                            <span
                                key={output.id}
                                className="text-[11px] text-slate-500"
                            >
                                {output.name}{i < config.outputs.length - 1 ? ',' : ''}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

interface AssignAgentInputProps {
    value?: AssignAgentConfig;
    onChange: (value: AssignAgentConfig) => void;
}

export function AssignAgentInput({ value, onChange }: AssignAgentInputProps) {
    const config = value || { strategy: 'least_leads' };

    return (
        <div className="space-y-0">
            <div
                onClick={() => onChange({ ...config, strategy: 'least_leads' })}
                className={`group flex items-center gap-3 px-2 py-2 rounded cursor-pointer transition-colors ${config.strategy === 'least_leads' ? 'bg-slate-50' : 'hover:bg-slate-50/50'
                    }`}
            >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${config.strategy === 'least_leads'
                    ? 'border-slate-500'
                    : 'border-slate-300'
                    }`}>
                    {config.strategy === 'least_leads' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    )}
                </div>
                <div>
                    <p className="text-[13px] font-normal text-slate-700">Least Leads</p>
                    <p className="text-[11px] text-slate-400">Distribute to agent with fewest leads</p>
                </div>
            </div>

            <div
                onClick={() => onChange({ ...config, strategy: 'always_admin' })}
                className={`group flex items-center gap-3 px-2 py-2 rounded cursor-pointer transition-colors ${config.strategy === 'always_admin' ? 'bg-slate-50' : 'hover:bg-slate-50/50'
                    }`}
            >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${config.strategy === 'always_admin'
                    ? 'border-slate-500'
                    : 'border-slate-300'
                    }`}>
                    {config.strategy === 'always_admin' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    )}
                </div>
                <div>
                    <p className="text-[13px] font-normal text-slate-700">Always Admin</p>
                    <p className="text-[11px] text-slate-400">Assign all leads to workspace admin</p>
                </div>
            </div>

            <div
                onClick={() => onChange({ ...config, strategy: 'smart' })}
                className={`group flex items-center gap-3 px-2 py-2 rounded cursor-pointer transition-colors ${config.strategy === 'smart' ? 'bg-slate-50' : 'hover:bg-slate-50/50'
                    }`}
            >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${config.strategy === 'smart'
                    ? 'border-slate-500'
                    : 'border-slate-300'
                    }`}>
                    {config.strategy === 'smart' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    )}
                </div>
                <div>
                    <p className="text-[13px] font-normal text-slate-700">Smart Match (AI)</p>
                    <p className="text-[11px] text-slate-400">Use AI to match by language &amp; expertise</p>
                </div>
            </div>
        </div>
    );
}


