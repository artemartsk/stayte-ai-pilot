import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Mail, Check, Plus, Trash2, Upload, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Branding Tab Content
const BrandingTab = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [logoUrl, setLogoUrl] = React.useState('');
    const [primaryColor, setPrimaryColor] = React.useState('#1a1a1a');
    const [isSaving, setIsSaving] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Fetch current agency settings
    const { data: agency, isLoading } = useQuery({
        queryKey: ['agency-branding', user?.agency_id],
        queryFn: async () => {
            if (!user?.agency_id) return null;
            const { data, error } = await supabase
                .from('agencies')
                .select('name, logo_url, primary_color')
                .eq('id', user.agency_id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.agency_id
    });

    React.useEffect(() => {
        if (agency) {
            setLogoUrl(agency.logo_url || '');
            setPrimaryColor(agency.primary_color || '#1a1a1a');
        }
    }, [agency]);

    const handleFileUpload = async (file: File) => {
        if (!user?.agency_id) return;
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
            const fileName = `${user.agency_id}/logo.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('agency-assets')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('agency-assets')
                .getPublicUrl(fileName);

            setLogoUrl(publicUrl);
            toast.success('Logo uploaded');
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

    const handleSave = async () => {
        if (!user?.agency_id) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('agencies')
                .update({ logo_url: logoUrl || null, primary_color: primaryColor })
                .eq('id', user.agency_id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['agency-branding'] });
            toast.success('Settings saved');
        } catch (err: any) {
            toast.error(err.message || 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveLogo = () => {
        setLogoUrl('');
    };

    if (isLoading) {
        return <div className="text-muted-foreground py-12 text-center">Loading...</div>;
    }

    return (
        <div className="max-w-xl">
            {/* Section: Logo */}
            <div className="mb-10">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-medium text-foreground">Agency Logo</span>
                </div>
                <p className="text-[13px] text-muted-foreground mb-4">
                    Displayed in email headers. Recommended: PNG with transparency, 400×100px.
                </p>

                {logoUrl ? (
                    <div className="group relative inline-block">
                        <div className="h-20 px-6 py-4 bg-muted/50 rounded-lg border border-border flex items-center justify-center">
                            <img
                                src={logoUrl}
                                alt="Agency logo"
                                className="max-h-12 max-w-[200px] object-contain"
                            />
                        </div>
                        <button
                            onClick={handleRemoveLogo}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                        >
                            ×
                        </button>
                    </div>
                ) : (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
                            ${isDragging
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                            }
                        `}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                            className="hidden"
                        />
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <Upload className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <span className="text-[13px] font-medium text-foreground">
                                    {isUploading ? 'Uploading...' : 'Drop logo here'}
                                </span>
                                <p className="text-[12px] text-muted-foreground mt-0.5">
                                    or click to browse
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Section: Brand Color */}
            <div className="mb-10">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-medium text-foreground">Brand Color</span>
                </div>
                <p className="text-[13px] text-muted-foreground mb-4">
                    Used for buttons and links in client emails.
                </p>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div
                            className="w-10 h-10 rounded-lg border border-border shadow-sm cursor-pointer"
                            style={{ backgroundColor: primaryColor }}
                        />
                    </div>
                    <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-28 font-mono text-[13px] h-10"
                        placeholder="#000000"
                    />
                    <div
                        className="px-4 h-10 rounded-lg text-white text-[13px] font-medium flex items-center"
                        style={{ backgroundColor: primaryColor }}
                    >
                        Button Preview
                    </div>
                </div>
            </div>

            {/* Save */}
            <div className="pt-6 border-t border-border">
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-9 px-4 text-[13px]"
                >
                    {isSaving ? 'Saving...' : 'Save changes'}
                </Button>
            </div>
        </div>
    );
};


// Integrations Tab Content
const IntegrationsTab = () => {
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
        <div className="space-y-6 max-w-4xl">
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
    );
};

// Lead Sources Tab Content
const LeadSourcesTab = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [newSourceName, setNewSourceName] = React.useState('');
    const [newSourceColor, setNewSourceColor] = React.useState('#f97316'); // Default orange
    const [isOpen, setIsOpen] = React.useState(false);

    const { data: sources, isLoading } = useQuery({
        queryKey: ['lead-sources', user?.agency_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('lead_sources')
                .select('*')
                .eq('agency_id', user?.agency_id)
                .order('name');

            if (error) throw error;
            return data;
        },
        enabled: !!user?.agency_id
    });

    const createSource = useMutation({
        mutationFn: async () => {
            // Basic slugification: lowercase and replace spaces with hyphens/underscores if desired, 
            // but here we just lowercase since the AI prompt uses names.
            // Actually, consistent name/id is good. Let's make name lowercase for ID purposes if needed, 
            // but lead_sources table has 'name' which is usually the key. 
            // Let's assume 'name' is the ID-like key and 'label' is display.
            // The migration used: name='idealista', label='Idealista'.

            const nameKey = newSourceName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');

            const { error } = await supabase
                .from('lead_sources')
                .insert({
                    agency_id: user?.agency_id,
                    name: nameKey,
                    label: newSourceName,
                    color: newSourceColor
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lead-sources'] });
            setIsOpen(false);
            setNewSourceName('');
            toast.success('Lead source created');
        },
        onError: (err: any) => {
            toast.error(`Error: ${err.message}`);
        }
    });

    const deleteSource = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('lead_sources')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lead-sources'] });
            toast.success('Lead source deleted');
        },
        onError: (err: any) => {
            toast.error(`Error: ${err.message}`);
        }
    });

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-medium">Lead Sources</h2>
                    <p className="text-sm text-muted-foreground">
                        Define which platforms you receive leads from. AI will classify leads into these categories.
                    </p>
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Source
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Lead Source</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    Name
                                </Label>
                                <Input
                                    id="name"
                                    value={newSourceName}
                                    onChange={(e) => setNewSourceName(e.target.value)}
                                    placeholder="e.g. Instagram"
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="color" className="text-right">
                                    Color
                                </Label>
                                <div className="col-span-3 flex gap-2">
                                    <Input
                                        id="color"
                                        type="color"
                                        value={newSourceColor}
                                        onChange={(e) => setNewSourceColor(e.target.value)}
                                        className="w-12 h-9 p-1 cursor-pointer"
                                    />
                                    <Input
                                        value={newSourceColor}
                                        onChange={(e) => setNewSourceColor(e.target.value)}
                                        className="flex-1 font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={() => createSource.mutate()} disabled={!newSourceName.trim() || createSource.isPending}>
                                {createSource.isPending ? 'Saving...' : 'Save Source'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4">
                {sources && sources.length > 0 ? (
                    <div className="border rounded-md divide-y">
                        {sources.map((source: any) => (
                            <div key={source.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: source.color }}
                                    />
                                    <div>
                                        <p className="font-medium">{source.label}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{source.name}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                        if (confirm(`Are you sure you want to delete ${source.label}?`)) {
                                            deleteSource.mutate(source.id);
                                        }
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 border border-dashed rounded-lg">
                        <p className="text-muted-foreground">No custom sources defined.</p>
                    </div>
                )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-sm text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">How AI uses these sources:</p>
                <p>When you receive an email (e.g., "From Rightmove"), our AI checks this list. If "Rightmove" exists here, it assigns that source. If not, it might use generic "Portal" or "Other". Add your important sources here to ensure accurate reporting.</p>
            </div>
        </div>
    );
};

const Settings = () => {
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border px-12 py-6">
                <h1 className="text-2xl font-semibold">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage your agency configuration
                </p>
            </div>

            {/* Content */}
            <div className="px-12 py-8">
                <Tabs defaultValue="integrations" className="w-full">
                    <TabsList className="mb-8">
                        <TabsTrigger value="integrations">Integrations</TabsTrigger>
                        <TabsTrigger value="sources">Lead Sources</TabsTrigger>
                        <TabsTrigger value="branding">Branding</TabsTrigger>
                    </TabsList>

                    <TabsContent value="integrations">
                        <IntegrationsTab />
                    </TabsContent>

                    <TabsContent value="sources">
                        <LeadSourcesTab />
                    </TabsContent>

                    <TabsContent value="branding">
                        <BrandingTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default Settings;
