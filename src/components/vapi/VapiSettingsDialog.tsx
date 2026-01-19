import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetFooter
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Loader2, Save, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export const VapiSettingsDialog = () => {
    const [open, setOpen] = useState(false);
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Form State
    const [phoneNumberId, setPhoneNumberId] = useState('');
    const [voiceId, setVoiceId] = useState('Paige');
    const [voiceProvider, setVoiceProvider] = useState('vapi');
    const [firstMessage, setFirstMessage] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');

    // Test Call State
    const [testPhoneNumber, setTestPhoneNumber] = useState('');

    // Fetch Available Voices
    const { data: voices = [] } = useQuery({
        queryKey: ['vapi-voices'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('get-vapi-voices');
            if (error) throw error;
            return data || [];
        }
    });

    // Fetch Agency Settings
    const { data: agency, isLoading } = useQuery({
        queryKey: ['agency-vapi-settings'],
        enabled: open && !!user,
        queryFn: async () => {
            const { data: member } = await supabase
                .from('memberships')
                .select('agency_id')
                .eq('user_id', user?.id)
                .single();

            if (!member) throw new Error('No agency found');

            const { data: agency } = await supabase
                .from('agencies')
                .select('id, vapi_settings')
                .eq('id', member.agency_id)
                .single();

            return agency;
        }
    });

    // Populate form on load
    useEffect(() => {
        if (agency?.vapi_settings) {
            const s = agency.vapi_settings as any;
            setPhoneNumberId(s.phoneNumberId || '27d8b1ec-f601-443b-8fef-c0f8b01ae8f6');

            if (s.assistant) {
                setVoiceId(s.assistant.voice?.voiceId || 'Paige');
                setVoiceProvider(s.assistant.voice?.provider || 'vapi');
                setFirstMessage(s.assistant.firstMessage || '');
                const sysMsg = s.assistant.model?.messages?.find((m: any) => m.role === 'system');
                setSystemPrompt(sysMsg?.content || '');
            }
        }
    }, [agency]);

    // Update Mutation
    const updateSettings = useMutation({
        mutationFn: async () => {
            if (!agency?.id) return;

            const newSettings = {
                phoneNumberId,
                assistant: {
                    name: "Reviero Property Consultant",
                    voice: {
                        provider: voiceProvider,
                        voiceId
                    },
                    model: {
                        provider: 'openai',
                        model: 'gpt-4.1',
                        messages: [
                            { role: 'system', content: systemPrompt }
                        ]
                    },
                    voicemailDetection: {
                        provider: "openai",
                        backoffPlan: {
                            startAtSeconds: 0.5,
                            frequencySeconds: 2.5,
                            maxRetries: 2
                        },
                        beepMaxAwaitSeconds: 2
                    },
                    firstMessage
                },
                customer: {
                    number: "{{ customer.number }}"
                }
            };

            const { error } = await supabase
                .from('agencies')
                .update({ vapi_settings: newSettings })
                .eq('id', agency.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Call settings updated');
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ['agency-vapi-settings'] });
        },
        onError: (err) => {
            toast.error('Failed to save settings');
            console.error(err);
        }
    });

    // Test Call Mutation
    const testCall = useMutation({
        mutationFn: async () => {
            if (!testPhoneNumber) throw new Error('Enter a phone number');

            const settings = {
                phoneNumberId,
                assistant: {
                    name: "Reviero Property Consultant",
                    voice: { provider: voiceProvider, voiceId },
                    model: {
                        provider: 'openai',
                        model: 'gpt-4.1',
                        messages: [{ role: 'system', content: systemPrompt }]
                    },
                    voicemailDetection: {
                        provider: "openai",
                        backoffPlan: { startAtSeconds: 0.5, frequencySeconds: 2.5, maxRetries: 2 },
                        beepMaxAwaitSeconds: 2
                    },
                    firstMessage: firstMessage.replace(/\{\{first_name\}\}/g, 'Test User').replace(/\{\{marketing_source\}\}/g, 'Test')
                }
            };

            const { data, error } = await supabase.functions.invoke('test-call', {
                body: { phoneNumber: testPhoneNumber, settings }
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error || 'Call failed');
            return data;
        },
        onSuccess: () => {
            toast.success('Test call initiated! Your phone will ring shortly.');
        },
        onError: (err) => {
            toast.error('Failed to initiate call: ' + (err as Error).message);
            console.error(err);
        }
    });

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50" title="Call Settings">
                    <Settings className="h-4 w-4" />
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Vapi Automation Settings</SheetTitle>
                    <SheetDescription>
                        Configure how the AI agent calls your leads. These settings apply to your entire agency.
                    </SheetDescription>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                    <div className="space-y-6 py-4 px-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Phone Number ID (Vapi)</Label>
                                <Input
                                    value={phoneNumberId}
                                    onChange={(e) => setPhoneNumberId(e.target.value)}
                                    placeholder="e.g. 3c383b83-..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Voice</Label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={voiceId}
                                    onChange={(e) => {
                                        const selected = voices.find((v: any) => v.id === e.target.value);
                                        setVoiceId(e.target.value);
                                        if (selected) setVoiceProvider(selected.provider);
                                    }}
                                >
                                    <option value="" disabled>Select a voice</option>
                                    {!voices.find((v: any) => v.id === voiceId) && voiceId && (
                                        <option value={voiceId}>{voiceId} (Current)</option>
                                    )}
                                    {voices.map((v: any) => (
                                        <option key={v.id} value={v.id}>
                                            {v.name} ({v.provider} - {v.gender})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>First Message</Label>
                            <Textarea
                                value={firstMessage}
                                onChange={(e) => setFirstMessage(e.target.value)}
                                placeholder="Hi {{first_name}}! It's Isabella..."
                                className="h-24 font-medium"
                            />
                            <p className="text-xs text-muted-foreground">Supported variables: <code>{'{{first_name}}'}</code>, <code>{'{{marketing_source}}'}</code> automatically injected.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>System Prompt (Instructions)</Label>
                            <Textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                placeholder="You are Isabella..."
                                className="h-[300px] font-mono text-sm"
                            />
                            <p className="text-xs text-muted-foreground">Define the bot's persona, goal, and constraints here.</p>
                        </div>

                        {/* Test Call Section */}
                        <div className="border-t pt-6 mt-6">
                            <h3 className="text-lg font-semibold mb-4">🧪 Test Call</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Enter your phone number to receive a test call with the current settings.
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    value={testPhoneNumber}
                                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                                    placeholder="+34612345678"
                                    className="max-w-xs"
                                />
                                <Button
                                    onClick={() => testCall.mutate()}
                                    disabled={testCall.isPending || !testPhoneNumber}
                                    variant="secondary"
                                >
                                    {testCall.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Phone className="h-4 w-4 mr-2" />
                                    )}
                                    Call Me
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <SheetFooter className="pb-8">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending}>
                        {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Configuration
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};
