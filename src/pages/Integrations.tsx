import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Mail, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Integrations = () => {
    const { user } = useAuth();
    const inboundEmail = `${user?.agency_id}@leads.stayte.ai`;
    const [copied, setCopied] = React.useState(false);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Copied to clipboard");
    };

    const handleTestLead = async () => {
        try {
            const { data, error } = await supabase.functions.invoke('handle-inbound-lead', {
                body: {
                    to: inboundEmail,
                    subject: "Test Lead from Stayte Interface",
                    text: "Nombre: Juan Test Dominguez\nEmail: juan@example.com\nTeléfono: +34 600 000 000\nHola, me interesa el piso en Calle Mayor 123.",
                }
            });

            if (error) {
                console.error('Function error:', error);
                toast.error(`Error: ${error.message || 'Failed to process test lead'}`);
                return;
            }

            console.log('Function response:', data);
            toast.success('Test lead sent! Check Leads page.');
        } catch (err: any) {
            console.error('Unexpected error:', err);
            toast.error(`Error: ${err.message || 'Unexpected error'}`);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border px-12 py-6">
                <h1 className="text-2xl font-semibold">Integrations</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Connect your lead sources
                </p>
            </div>

            {/* Content */}
            <div className="px-12 py-8 max-w-4xl">
                {/* Idealista Section */}
                <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-medium mb-1">Idealista</h2>
                        <p className="text-sm text-muted-foreground">
                            Forward leads automatically via email
                        </p>
                    </div>

                    {/* Unique Email */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Your unique email
                        </label>
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={inboundEmail}
                                className="font-mono text-sm bg-muted/50"
                            />
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(inboundEmail)}
                                className="gap-2"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        Copy
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Instructions */}
                    <Card className="p-6 bg-muted/20 border-border/40">
                        <h3 className="font-medium text-sm mb-4">Setup Instructions</h3>
                        <ol className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex gap-3">
                                <span className="text-foreground font-medium">1.</span>
                                <span>Copy your unique email address above</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-foreground font-medium">2.</span>
                                <span>Open your email client (Gmail, Outlook, etc.)</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-foreground font-medium">3.</span>
                                <span>Create a filter: if sender contains <code className="px-1.5 py-0.5 bg-muted rounded text-xs">idealista.com</code>, forward to your Stayte email</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-foreground font-medium">4.</span>
                                <span>Our AI will automatically parse and create the lead</span>
                            </li>
                        </ol>
                    </Card>

                    {/* Test Button */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div>
                            <p className="text-sm font-medium">Test the integration</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Send a test lead to verify your setup
                            </p>
                        </div>
                        <Button
                            onClick={handleTestLead}
                            variant="outline"
                            size="sm"
                        >
                            <Mail className="h-4 w-4 mr-2" />
                            Send Test Lead
                        </Button>
                    </div>
                </div>

                {/* Divider */}
                <div className="my-12 border-t border-border" />

                {/* Other Integrations */}
                <div>
                    <h2 className="text-lg font-medium mb-6">More integrations</h2>
                    <div className="grid gap-4">
                        <div className="p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-not-allowed opacity-60">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-sm">Idealista Pro Gateway</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Direct webhook integration
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground">Coming soon</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-not-allowed opacity-60">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-sm">WhatsApp Business</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Direct inbound messaging
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground">Coming soon</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-not-allowed opacity-60">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-sm">Website Forms</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Embed code for your website
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground">Coming soon</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Integrations;
