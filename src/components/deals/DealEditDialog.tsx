import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { X, Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type Deal = Database['public']['Tables']['deals']['Row'];
type DealPreferences = Database['public']['Tables']['deal_preference_profiles']['Row'];

interface DealEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    deal: Deal;
    preferences?: DealPreferences | null;
    contactId: string;
}

export const DealEditDialog = ({
    open,
    onOpenChange,
    deal,
    preferences,
    contactId,
}: DealEditDialogProps) => {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        budgetMin: '',
        budgetMax: '',
        areas: [] as string[],
        propertyTypes: [] as string[],
        mustHaves: [] as string[],
        niceToHaves: [] as string[],
        bedrooms: '',
        bathrooms: '',
        sizeSqM: '',
    });

    const [areaInput, setAreaInput] = useState('');
    const [propertyTypeInput, setPropertyTypeInput] = useState('');
    const [mustHaveInput, setMustHaveInput] = useState('');
    const [niceToHaveInput, setNiceToHaveInput] = useState('');

    useEffect(() => {
        if (deal) {
            setFormData({
                budgetMin: deal.budget_min?.toString() || '',
                budgetMax: deal.budget_max?.toString() || '',
                areas: deal.areas || [],
                propertyTypes: deal.property_types || [],
                mustHaves: deal.must_haves || [],
                niceToHaves: deal.nice_to_haves || [],
                bedrooms: preferences?.bedrooms?.toString() || '',
                bathrooms: preferences?.bathrooms?.toString() || '',
                sizeSqM: preferences?.size_sq_m?.toString() || '',
            });
        }
    }, [deal, preferences]);

    const updateDealMutation = useMutation({
        mutationFn: async () => {
            // Update deals table
            const { error: dealError } = await supabase
                .from('deals')
                .update({
                    budget_min: formData.budgetMin ? Number(formData.budgetMin) : null,
                    budget_max: formData.budgetMax ? Number(formData.budgetMax) : null,
                    areas: formData.areas,
                    property_types: formData.propertyTypes,
                    must_haves: formData.mustHaves,
                    nice_to_haves: formData.niceToHaves,
                })
                .eq('id', deal.id);

            if (dealError) throw dealError;

            // Update deal_preference_profiles table
            const propertyTypeFlags = {
                type_villa: formData.propertyTypes.includes('Villa'),
                type_apartment: formData.propertyTypes.includes('Apartment'),
                type_townhouse: formData.propertyTypes.includes('Townhouse'),
                type_land_plot: formData.propertyTypes.includes('Land Plot'),
                subtype_penthouse: formData.propertyTypes.includes('Penthouse'),
                subtype_finca_cortijo: formData.propertyTypes.includes('Finca'),
                subtype_ground_floor_studio: formData.propertyTypes.includes('Studio'),
            };

            const { error: prefError } = await supabase
                .from('deal_preference_profiles')
                .update({
                    bedrooms: formData.bedrooms ? Number(formData.bedrooms) : null,
                    bathrooms: formData.bathrooms ? Number(formData.bathrooms) : null,
                    size_sq_m: formData.sizeSqM ? Number(formData.sizeSqM) : null,
                    budget: formData.budgetMax ? Number(formData.budgetMax) : null,
                    max_budget: formData.budgetMax ? Number(formData.budgetMax) : null,
                    ...propertyTypeFlags,
                } as any)
                .eq('deal_id', deal.id);

            if (prefError) throw prefError;

            // Trigger contact update to re-evaluate group assignment
            await supabase
                .from('contacts')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', contactId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contact-deals'] });
            queryClient.invalidateQueries({ queryKey: ['deal-preferences'] });
            queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
            toast.success('Deal updated successfully');
            onOpenChange(false);
        },
        onError: (error) => {
            toast.error('Failed to update deal: ' + error.message);
        },
    });

    const addTag = (
        field: 'areas' | 'propertyTypes' | 'mustHaves' | 'niceToHaves',
        value: string,
        setInput: (v: string) => void
    ) => {
        if (value.trim() && !formData[field].includes(value.trim())) {
            setFormData((prev) => ({
                ...prev,
                [field]: [...prev[field], value.trim()],
            }));
        }
        setInput('');
    };

    const removeTag = (field: 'areas' | 'propertyTypes' | 'mustHaves' | 'niceToHaves', index: number) => {
        setFormData((prev) => ({
            ...prev,
            [field]: prev[field].filter((_, i) => i !== index),
        }));
    };

    const handleKeyDown = (
        e: React.KeyboardEvent,
        field: 'areas' | 'propertyTypes' | 'mustHaves' | 'niceToHaves',
        value: string,
        setInput: (v: string) => void
    ) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(field, value, setInput);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Deal</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Budget */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="budgetMin">Min Budget (€)</Label>
                            <Input
                                id="budgetMin"
                                type="number"
                                value={formData.budgetMin}
                                onChange={(e) => setFormData((prev) => ({ ...prev, budgetMin: e.target.value }))}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="budgetMax">Max Budget (€)</Label>
                            <Input
                                id="budgetMax"
                                type="number"
                                value={formData.budgetMax}
                                onChange={(e) => setFormData((prev) => ({ ...prev, budgetMax: e.target.value }))}
                                placeholder="No limit"
                            />
                        </div>
                    </div>

                    {/* Areas */}
                    <div className="space-y-2">
                        <Label>Areas of Interest</Label>
                        <Input
                            placeholder="Type area and press Enter"
                            value={areaInput}
                            onChange={(e) => setAreaInput(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'areas', areaInput, setAreaInput)}
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                            {formData.areas.map((area, i) => (
                                <Badge key={i} variant="secondary" className="gap-1">
                                    {area}
                                    <button onClick={() => removeTag('areas', i)} className="hover:bg-black/10 rounded-full">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Property Types */}
                    <div className="space-y-2">
                        <Label>Property Types</Label>
                        <Select
                            value=""
                            onValueChange={(value) => {
                                if (value && !formData.propertyTypes.includes(value)) {
                                    setFormData((prev) => ({
                                        ...prev,
                                        propertyTypes: [...prev.propertyTypes, value],
                                    }));
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select property type..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Villa">Villa</SelectItem>
                                <SelectItem value="Apartment">Apartment</SelectItem>
                                <SelectItem value="Townhouse">Townhouse</SelectItem>
                                <SelectItem value="Penthouse">Penthouse</SelectItem>
                                <SelectItem value="Land Plot">Land Plot</SelectItem>
                                <SelectItem value="Finca">Finca</SelectItem>
                                <SelectItem value="Studio">Studio</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-1 mt-2">
                            {formData.propertyTypes.map((type, i) => (
                                <Badge key={i} variant="outline" className="gap-1">
                                    {type}
                                    <button onClick={() => removeTag('propertyTypes', i)} className="hover:bg-black/10 rounded-full">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Must Haves */}
                    <div className="space-y-2">
                        <Label>Must Haves</Label>
                        <Input
                            placeholder="Type must-have and press Enter"
                            value={mustHaveInput}
                            onChange={(e) => setMustHaveInput(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'mustHaves', mustHaveInput, setMustHaveInput)}
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                            {formData.mustHaves.map((item, i) => (
                                <Badge key={i} variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700">
                                    {item}
                                    <button onClick={() => removeTag('mustHaves', i)} className="hover:bg-black/10 rounded-full">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Nice to Haves */}
                    <div className="space-y-2">
                        <Label>Nice to Haves</Label>
                        <Input
                            placeholder="Type nice-to-have and press Enter"
                            value={niceToHaveInput}
                            onChange={(e) => setNiceToHaveInput(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'niceToHaves', niceToHaveInput, setNiceToHaveInput)}
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                            {formData.niceToHaves.map((item, i) => (
                                <Badge key={i} variant="secondary" className="gap-1 bg-amber-50 text-amber-700">
                                    {item}
                                    <button onClick={() => removeTag('niceToHaves', i)} className="hover:bg-black/10 rounded-full">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Detailed Preferences */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bedrooms">Bedrooms</Label>
                            <Input
                                id="bedrooms"
                                type="number"
                                value={formData.bedrooms}
                                onChange={(e) => setFormData((prev) => ({ ...prev, bedrooms: e.target.value }))}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bathrooms">Bathrooms</Label>
                            <Input
                                id="bathrooms"
                                type="number"
                                value={formData.bathrooms}
                                onChange={(e) => setFormData((prev) => ({ ...prev, bathrooms: e.target.value }))}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sizeSqM">Size (m²)</Label>
                            <Input
                                id="sizeSqM"
                                type="number"
                                value={formData.sizeSqM}
                                onChange={(e) => setFormData((prev) => ({ ...prev, sizeSqM: e.target.value }))}
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={() => updateDealMutation.mutate()} disabled={updateDealMutation.isPending}>
                        {updateDealMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
