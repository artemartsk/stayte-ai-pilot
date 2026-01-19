import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GroupBadge } from './GroupBadge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface ContactGroup {
    id: string;
    name: string;
    description: string | null;
    color: string;
    created_at: string;
    member_count?: number;
    filter_criteria?: {
        minBudget?: number;
        maxBudget?: number;
        locations?: string[];
        propertyType?: string;
        minBedrooms?: number;
    } | null;
}

interface GroupsManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const DEFAULT_COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
];

export const GroupsManager = ({ open, onOpenChange }: GroupsManagerProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
    const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: DEFAULT_COLORS[0],
        minBudget: '',
        maxBudget: '',
        locations: [] as string[],
        propertyType: '',
        minBedrooms: '',
    });
    const [locationInput, setLocationInput] = useState('');

    const { data: groups = [], isLoading } = useQuery({
        queryKey: ['contact-groups', user?.agency_id],
        queryFn: async () => {
            if (!user?.agency_id) return [];

            const { data, error } = await supabase
                .from('contact_groups')
                .select('*, contacts(count)')
                .eq('agency_id', user.agency_id)
                .order('name');

            if (error) throw error;

            return (data || []).map((group: any) => ({
                ...group,
                member_count: group.contacts?.[0]?.count || 0,
            }));
        },
        enabled: !!user?.agency_id && open,
    });

    const createGroupMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (!user?.agency_id) throw new Error('No agency ID');

            const { data: newGroup, error } = await supabase
                .from('contact_groups')
                .insert({
                    agency_id: user.agency_id,
                    name: data.name,
                    description: data.description || null,
                    color: data.color,
                    created_by: user.id,
                    filter_criteria: {
                        minBudget: data.minBudget ? Number(data.minBudget) : undefined,
                        maxBudget: data.maxBudget ? Number(data.maxBudget) : undefined,
                        locations: data.locations,
                        propertyType: data.propertyType || undefined,
                        minBedrooms: data.minBedrooms ? Number(data.minBedrooms) : undefined,
                    },
                })
                .select()
                .single();

            if (error) throw error;
            return newGroup;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contact-groups'] });
            toast.success('Group created successfully');
            resetForm();
        },
        onError: (error: any) => {
            toast.error('Failed to create group: ' + error.message);
        },
    });

    const updateGroupMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
            const { data: updatedGroup, error } = await supabase
                .from('contact_groups')
                .update({
                    name: data.name,
                    description: data.description || null,

                    color: data.color,
                    filter_criteria: {
                        minBudget: data.minBudget ? Number(data.minBudget) : undefined,
                        maxBudget: data.maxBudget ? Number(data.maxBudget) : undefined,
                        locations: data.locations,
                        propertyType: data.propertyType || undefined,
                        minBedrooms: data.minBedrooms ? Number(data.minBedrooms) : undefined,
                    },
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return updatedGroup;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contact-groups'] });
            toast.success('Group updated successfully');
            resetForm();
        },
        onError: (error: any) => {
            toast.error('Failed to update group: ' + error.message);
        },
    });

    const deleteGroupMutation = useMutation({
        mutationFn: async (groupId: string) => {
            const { error } = await supabase
                .from('contact_groups')
                .delete()
                .eq('id', groupId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contact-groups'] });
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            toast.success('Group deleted successfully');
            setDeleteGroupId(null);
        },
        onError: (error: any) => {
            toast.error('Failed to delete group: ' + error.message);
        },
    });

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            color: DEFAULT_COLORS[0],
            minBudget: '',
            maxBudget: '',
            locations: [],
            propertyType: '',
            minBedrooms: '',
        });
        setLocationInput('');
        setIsCreating(false);
        setEditingGroup(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingGroup) {
            updateGroupMutation.mutate({ id: editingGroup.id, data: formData });
        } else {
            createGroupMutation.mutate(formData);
        }
    };

    const startEdit = (group: ContactGroup) => {
        setEditingGroup(group);
        setFormData({
            name: group.name,
            description: group.description || '',

            color: group.color,
            minBudget: group.filter_criteria?.minBudget?.toString() || '',
            maxBudget: group.filter_criteria?.maxBudget?.toString() || '',
            locations: group.filter_criteria?.locations || [],
            propertyType: group.filter_criteria?.propertyType || '',
            minBedrooms: group.filter_criteria?.minBedrooms?.toString() || '',
        });
        setIsCreating(true);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Manage Groups</DialogTitle>
                        <DialogDescription>
                            Create and organize groups to classify your leads
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {!isCreating ? (
                            <Button onClick={() => setIsCreating(true)} className="w-full">
                                <Plus className="h-4 w-4 mr-2" />
                                Create New Group
                            </Button>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4">
                                <div className="space-y-2">
                                    <Label htmlFor="group-name">Group Name *</Label>
                                    <Input
                                        id="group-name"
                                        placeholder="e.g., Hot Leads, VIP Clients"
                                        value={formData.name}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                        required
                                    />
                                </div>



                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="min-budget">Min Budget</Label>
                                        <Input
                                            id="min-budget"
                                            type="number"
                                            placeholder="0"
                                            value={formData.minBudget}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, minBudget: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="max-budget">Max Budget</Label>
                                        <Input
                                            id="max-budget"
                                            type="number"
                                            placeholder="No limit"
                                            value={formData.maxBudget}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, maxBudget: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Locations (Tags)</Label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {formData.locations.map((loc, index) => (
                                            <Badge key={index} variant="secondary" className="gap-1">
                                                {loc}
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({
                                                        ...prev,
                                                        locations: prev.locations.filter((_, i) => i !== index)
                                                    }))}
                                                    className="hover:text-destructive"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                    <Input
                                        placeholder="Type location and press Enter"
                                        value={locationInput}
                                        onChange={(e) => setLocationInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (locationInput.trim()) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        locations: [...prev.locations, locationInput.trim()]
                                                    }));
                                                    setLocationInput('');
                                                }
                                            }
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Property Type</Label>
                                        <Select
                                            value={formData.propertyType}
                                            onValueChange={(value) => setFormData(prev => ({ ...prev, propertyType: value }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="apartment">Apartment</SelectItem>
                                                <SelectItem value="villa">Villa</SelectItem>
                                                <SelectItem value="townhouse">Townhouse</SelectItem>
                                                <SelectItem value="land">Land Plot</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Min Bedrooms</Label>
                                        <Select
                                            value={formData.minBedrooms}
                                            onValueChange={(value) => setFormData(prev => ({ ...prev, minBedrooms: value }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Any" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0">Studio</SelectItem>
                                                <SelectItem value="1">1+</SelectItem>
                                                <SelectItem value="2">2+</SelectItem>
                                                <SelectItem value="3">3+</SelectItem>
                                                <SelectItem value="4">4+</SelectItem>
                                                <SelectItem value="5">5+</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="group-description">Description (optional)</Label>
                                    <Textarea
                                        id="group-description"
                                        placeholder="Describe this group..."
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, description: e.target.value }))
                                        }
                                        rows={2}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Color</Label>
                                    <div className="flex gap-2 flex-wrap">
                                        {DEFAULT_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color ? 'border-foreground scale-110' : 'border-border'
                                                    }`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setFormData((prev) => ({ ...prev, color }))}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        type="submit"
                                        disabled={createGroupMutation.isPending || updateGroupMutation.isPending}
                                    >
                                        {createGroupMutation.isPending || updateGroupMutation.isPending ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : editingGroup ? (
                                            'Update Group'
                                        ) : (
                                            'Create Group'
                                        )}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={resetForm}>
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        )}

                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Existing Groups</h3>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : groups.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No groups yet. Create your first group above.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {groups.map((group) => (
                                        <div
                                            key={group.id}
                                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                                        >
                                            <div className="flex items-center gap-3 flex-1">
                                                <GroupBadge name={group.name} color={group.color} />
                                                <div className="flex-1">
                                                    {group.description && (
                                                        <p className="text-xs text-muted-foreground">{group.description}</p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {group.member_count || 0} contacts
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => startEdit(group)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                {group.name !== 'Hot Buyer' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDeleteGroupId(group.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog >

            <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Group</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this group? This will remove the group from all contacts but will not delete the contacts themselves.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteGroupId && deleteGroupMutation.mutate(deleteGroupId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
