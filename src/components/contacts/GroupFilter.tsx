import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Filter } from 'lucide-react';
import { GroupBadge } from './GroupBadge';
import { Badge } from '@/components/ui/badge';

interface ContactGroup {
    id: string;
    name: string;
    color: string;
}

interface GroupFilterProps {
    selectedGroupIds: string[];
    onGroupsChange: (groupIds: string[]) => void;
}

export const GroupFilter = ({ selectedGroupIds, onGroupsChange }: GroupFilterProps) => {
    const { user } = useAuth();

    const { data: groups = [] } = useQuery({
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
        enabled: !!user?.agency_id,
    });

    const handleAddGroup = (groupId: string) => {
        if (!selectedGroupIds.includes(groupId)) {
            onGroupsChange([...selectedGroupIds, groupId]);
        }
    };

    const handleRemoveGroup = (groupId: string) => {
        onGroupsChange(selectedGroupIds.filter((id) => id !== groupId));
    };

    const selectedGroups = groups.filter((g) => selectedGroupIds.includes(g.id));

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select onValueChange={handleAddGroup}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by group..." />
                    </SelectTrigger>
                    <SelectContent>
                        {groups.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">No groups available</div>
                        ) : (
                            groups
                                .filter((g) => !selectedGroupIds.includes(g.id))
                                .map((group) => (
                                    <SelectItem key={group.id} value={group.id}>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: group.color }}
                                            />
                                            {group.name}
                                        </div>
                                    </SelectItem>
                                ))
                        )}
                    </SelectContent>
                </Select>

                {selectedGroupIds.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onGroupsChange([])}
                        className="text-muted-foreground"
                    >
                        Clear filters
                    </Button>
                )}
            </div>

            {selectedGroups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedGroups.map((group) => (
                        <Badge
                            key={group.id}
                            variant="secondary"
                            className="gap-1 pr-1"
                            style={{
                                borderColor: group.color,
                                backgroundColor: `${group.color}15`,
                            }}
                        >
                            <span style={{ color: group.color }}>{group.name}</span>
                            <button
                                onClick={() => handleRemoveGroup(group.id)}
                                className="ml-1 hover:bg-background rounded-full p-0.5"
                            >
                                <X className="h-3 w-3" style={{ color: group.color }} />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
};
