
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Phone, Clock, DollarSign } from 'lucide-react';
import { MOCK_PIPELINES } from '@/components/deals/PipelineSelector';

interface Contact {
    id: string;
    first_name: string;
    last_name: string;
    primary_email?: string;
    primary_phone?: string;
    created_at: string;
    deals?: any[];
    [key: string]: any;
}

interface ContactsKanbanProps {
    contacts: Contact[];
}

export function ContactsKanban({ contacts }: ContactsKanbanProps) {
    const navigate = useNavigate();

    // Define columns based on the default pipeline + a "No Deal" column
    const columns = useMemo(() => {
        const defaultStages = MOCK_PIPELINES[0].stages;
        return [
            { id: 'no_deal', name: 'No Deal', color: 'bg-slate-100 text-slate-700 border-slate-200' },
            ...defaultStages
        ];
    }, []);

    // Group contacts by their LATEST deal's stage
    const groupedContacts = useMemo(() => {
        const groups: Record<string, Contact[]> = {};

        // Initialize groups
        columns.forEach(col => {
            groups[col.id] = [];
        });

        contacts.forEach(contact => {
            let stageId = 'no_deal';

            if (contact.deals && contact.deals.length > 0) {
                // Find the most recent deal
                // Assuming deals are sorted by created_at desc in the query, or we sort here
                // The query in Contacts.tsx doesn't sort deals inside the select, so we should sort here to be safe
                const sortedDeals = [...contact.deals].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                const latestDeal = sortedDeals[0];
                if (latestDeal && latestDeal.status) {
                    // Verify if stage exists in our columns, if not fallback to 'no_deal' or maybe 'lost' if appropriate?
                    // For now, if stage is not in our default pipeline, put it in no_deal or maybe we need a 'Other' column?
                    // Let's assume standard stages.
                    if (columns.find(c => c.id === latestDeal.status)) {
                        stageId = latestDeal.status;
                    }
                }
            }

            if (!groups[stageId]) {
                groups[stageId] = [];
            }
            groups[stageId].push(contact);
        });

        return groups;
    }, [contacts, columns]);

    return (
        <div className="flex h-[calc(100vh-120px)] overflow-x-auto pb-4 gap-3">
            {columns.map(column => (
                <div key={column.id} className="flex-shrink-0 w-44 flex flex-col">
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-sm ${column.color.split(' ')[0].replace('text-', 'bg-').replace('border-', 'border-')}`}></span>
                            <h3 className="font-medium text-[13px] text-foreground/75">{column.name}</h3>
                        </div>
                        <span className="text-[11px] text-muted-foreground ml-2">
                            {groupedContacts[column.id]?.length || 0}
                        </span>
                    </div>

                    {/* Column Content */}
                    <div className="flex-1">
                        <ScrollArea className="h-full">
                            <div className="flex flex-col gap-2 pb-2">
                                {groupedContacts[column.id]?.map(contact => {
                                    // Get latest deal
                                    const deals = contact.deals || [];
                                    const latestDeal = deals.length > 0
                                        ? [...deals].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                                        : null;

                                    // Real data mapping from latest deal
                                    const score = 0;
                                    const intent = latestDeal?.type || null;

                                    // Budget
                                    const budget = latestDeal?.budget_max || 0;
                                    const formattedBudget = budget ? `€${budget.toLocaleString('fr-FR').replace(/,/g, ' ')}` : '-';

                                    // Agent from contact owner
                                    const agentName = contact.owner?.full_name || 'Unassigned';
                                    const agentIdShort = contact.owner?.id?.substring(0, 4) || '---';

                                    // Location tags from deal areas
                                    const locations = Array.isArray(latestDeal?.areas) ? latestDeal.areas : [];
                                    const displayLocations = locations.slice(0, 2);
                                    const moreLocationsCount = locations.length > 2 ? locations.length - 2 : 0;

                                    return (
                                        <Card
                                            key={contact.id}
                                            onClick={() => navigate(`/contacts/${contact.id}`)}
                                            className="group p-3 cursor-pointer hover:shadow-md transition-all border border-border/40 hover:border-border/60 shadow-sm rounded-xl bg-white space-y-3"
                                        >
                                            {/* Row 1: Intent Tag & Score */}
                                            <div className="flex items-center justify-between min-h-[22px]">
                                                {intent && (
                                                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[10px] font-normal min-w-0 bg-slate-100 text-slate-600 hover:bg-slate-200 uppercase tracking-wide">
                                                        {intent}
                                                    </Badge>
                                                )}
                                                {!intent && <div></div>} {/* Spacer if no intent */}

                                                <div className="flex items-center gap-1 text-orange-500 font-medium text-xs">
                                                    <span className="text-orange-500">🔥</span>
                                                    <span>{score}</span>
                                                </div>
                                            </div>

                                            {/* Row 2: Name & Price */}
                                            <div className="space-y-0.5">
                                                <div className="font-bold text-sm text-slate-900 truncate leading-tight">
                                                    {contact.first_name} {contact.last_name}
                                                </div>
                                                <div className="text-sm font-medium text-slate-500 truncate">
                                                    {formattedBudget}
                                                </div>
                                            </div>

                                            {/* Row 3: Agent & ID */}
                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <div className="truncate max-w-[60%]">
                                                    {agentName}
                                                </div>
                                                <div className="font-mono text-[10px] opacity-70">
                                                    ID: {agentIdShort}
                                                </div>
                                            </div>

                                            {/* Row 4: Location Tags */}
                                            {displayLocations.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {displayLocations.map((loc: string, idx: number) => (
                                                        <span key={idx} className="bg-slate-50 border border-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
                                                            {loc}
                                                        </span>
                                                    ))}
                                                    {moreLocationsCount > 0 && (
                                                        <span className="text-[10px] text-slate-400 px-1 py-0.5">
                                                            +{moreLocationsCount}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            ))}
        </div>
    );
}
