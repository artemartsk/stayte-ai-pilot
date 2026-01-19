import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

export function TwilioSettingsDialog() {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [agencyId, setAgencyId] = useState<string | null>(null);
    const [fromNumber, setFromNumber] = useState("");
    const [agentPrompt, setAgentPrompt] = useState("");
    const [enableAi, setEnableAi] = useState(false);
    const [extractInsights, setExtractInsights] = useState(false);

    useEffect(() => {
        if (open) {
            fetchAgencyAndSettings();
        }
    }, [open]);

    const fetchAgencyAndSettings = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('agency_id')
                .eq('id', user.id)
                .single();

            if (profile?.agency_id) {
                setAgencyId(profile.agency_id);

                const { data: agency } = await supabase
                    .from('agencies')
                    .select('twilio_settings')
                    .eq('id', profile.agency_id)
                    .single();

                const settings = (agency?.twilio_settings as Record<string, any>) || {};
                setFromNumber(settings.fromNumber || "");
                setAgentPrompt(settings.whatsappAgentPrompt || "");
                setEnableAi(settings.enableAi || false);
                setExtractInsights(settings.extractInsights || false);
            }
        } catch (err) {
            // console.error('Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!agencyId) {
            toast({
                title: "Error",
                description: "Agency ID not found",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        const settings = {
            fromNumber,
            whatsappAgentPrompt: agentPrompt,
            enableAi,
            extractInsights
        };

        const { error } = await supabase
            .from('agencies')
            .update({ twilio_settings: settings })
            .eq('id', agencyId);

        setLoading(false);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to save settings",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "WhatsApp settings saved",
            });
            setOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50" title="WhatsApp Settings">
                    <MessageSquare className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>WhatsApp Settings</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label>WhatsApp Number</Label>
                        <Input
                            placeholder="whatsapp:+14155238886"
                            value={fromNumber}
                            onChange={(e) => setFromNumber(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Use sandbox or platform number
                        </p>
                    </div>

                    <div className="space-y-4 pt-2 border-t">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Global AI Auto-Reply</Label>
                                <p className="text-[10px] text-muted-foreground">
                                    Enable AI agent by default for all chats
                                </p>
                            </div>
                            <Switch
                                checked={enableAi}
                                onCheckedChange={setEnableAi}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Global Insight Extraction</Label>
                                <p className="text-[10px] text-muted-foreground">
                                    Automatically extract lead details from all conversations
                                </p>
                            </div>
                            <Switch
                                checked={extractInsights}
                                onCheckedChange={setExtractInsights}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2 pt-2 border-t">
                        <Label>Global AI Agent Prompt</Label>
                        <Textarea
                            placeholder="You are a helpful real estate assistant..."
                            value={agentPrompt}
                            onChange={(e) => setAgentPrompt(e.target.value)}
                            className="min-h-[120px]"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            This prompt defines the personality and goals of the AI agent.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
