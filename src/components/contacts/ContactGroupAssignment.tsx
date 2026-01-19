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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GroupBadge } from './GroupBadge';

interface ContactGroup {
    id: string;
    name: string;
    color: string;
}

interface ContactGroupAssignmentProps {
    contactId: string;
    contactName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ContactGroupAssignment = ({
    contactId,
    contactName,
    open,
    onOpenChange,
}: ContactGroupAssignmentProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

    const { data: groups = [], isLoading: isLoadingGroups } = useQuery({
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
        enabled: !!user?.agency_id && open,
    });

    const { data: currentMemberships = [], isLoading: isLoadingMemberships } = useQuery({
        queryKey: ['contact-group-memberships', contactId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contact_group_members')
                .select('group_id')
                .eq('contact_id', contactId);

            if (error) throw error;
            return data || [];
        },
        enabled: !!contactId && open,
        onSuccess: (data) => {
            setSelectedGroupIds(new Set(data.map((m) => m.group_id)));
        },
    });

    const updateMembershipsMutation = useMutation({
        mutationFn: async (groupIds: Set<string>) => {
            const currentGroupIds = new Set(currentMemberships.map((m) => m.group_id));
            const groupIdsArray = Array.from(groupIds);

            // Find groups to add
            const toAdd = groupIdsArray.filter((id) => !currentGroupIds.has(id));
            // Find groups to remove
            const toRemove = Array.from(currentGroupIds).filter((id) => !groupIds.has(id));

            // Add new memberships
            if (toAdd.length > 0) {
                const { error: insertError } = await supabase
                    .from('contact_group_members')
                    .insert(
                        toAdd.map((groupId) => ({
                            contact_id: contactId,
                            group_id: groupId,
                            added_by: user?.id,
                        }))
                    );

                if (insertError) throw insertError;
            }

            // Remove old memberships
            if (toRemove.length > 0) {
                const { error: deleteError } = await supabase
                    .from('contact_group_members')
                    .delete()
                    .eq('contact_id', contactId)
                    .in('group_id', toRemove);

                if (deleteError) throw deleteError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            queryClient.invalidateQueries({ queryKey: ['contact-group-memberships'] });
            queryClient.invalidateQueries({ queryKey: ['contact-groups'] });
            toast.success('Groups updated successfully');
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast.error('Failed to update groups: ' + error.message);
        },
    });

    const toggleGroup = (groupId: string) => {
        const newSelected = new Set(selectedGroupIds);
        if (newSelected.has(groupId)) {
            newSelected.delete(groupId);
        } else {
            newSelected.add(groupId);
        }
        setSelectedGroupIds(newSelected);
    };

    const handleSave = () => {
        updateMembershipsMutation.mutate(selectedGroupIds);
    };

    const isLoading = isLoadingGroups || isLoadingMemberships;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manage Groups</DialogTitle>
                    <DialogDescription>
                        Assign {contactName} to groups
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No groups available. Create groups first to assign contacts.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {groups.map((group) => (
                                <div
                                    key={group.id}
                                    className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg cursor-pointer"
                                    onClick={() => toggleGroup(group.id)}
                                >
                                    <Checkbox
                                        checked={selectedGroupIds.has(group.id)}
                                        onCheckedChange={() => toggleGroup(group.id)}
                                    />
                                    <GroupBadge name={group.name} color={group.color} />
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={updateMembershipsMutation.isPending || groups.length === 0}
                        >
                            {updateMembershipsMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
