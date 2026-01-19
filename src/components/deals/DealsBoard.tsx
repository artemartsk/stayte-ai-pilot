import { useState, useEffect } from "react";
import { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { Pipeline } from "./PipelineSelector";
import { toast } from "sonner";

type Deal = Database["public"]["Tables"]["deals"]["Row"] & {
    contacts: { first_name: string | null; last_name: string | null } | null;
};

interface DealsBoardProps {
    deals: Deal[];
    members: { id: string; first_name: string | null; last_name: string | null; email: string | null }[];
    pipeline: Pipeline;
    isLoading: boolean;
}

export const DealsBoard = ({ deals, members, pipeline, isLoading }: DealsBoardProps) => {
    const navigate = useNavigate();
    const [columns, setColumns] = useState<Record<string, Deal[]>>({});

    useEffect(() => {
        if (deals) {
            const newColumns: Record<string, Deal[]> = {};
            pipeline.stages.forEach((stage) => {
                newColumns[stage.id] = deals.filter((deal) => deal.status === stage.id);
            });
            setColumns(newColumns);
        }
    }, [deals, pipeline]);

    const handleDragStart = (e: React.DragEvent, dealId: string) => {
        e.dataTransfer.setData("dealId", dealId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        const dealId = e.dataTransfer.getData("dealId");

        // Optimistic update
        const sourceStageId = Object.keys(columns).find(key =>
            columns[key].find(d => d.id === dealId)
        );

        if (sourceStageId && sourceStageId !== stageId) {
            const deal = columns[sourceStageId].find(d => d.id === dealId);
            if (deal) {
                setColumns(prev => ({
                    ...prev,
                    [sourceStageId]: prev[sourceStageId].filter(d => d.id !== dealId),
                    [stageId]: [...(prev[stageId] || []), { ...deal, status: stageId as any }]
                }));
                toast.success(`Deal moved to ${pipeline.stages.find(s => s.id === stageId)?.name}`);
                // TODO: Call API to update deal status
            }
        }
    };

    const getAgentName = (agentId: string | null) => {
        if (!agentId) return 'Unassigned';
        if (!members) return 'Unknown Agent';
        const agent = members.find(m => m.id === agentId);
        return agent ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email : 'Unknown Agent';
    };

    const getClientName = (deal: Deal) => {
        if (!deal.contacts) return 'Unknown Client';
        return `${deal.contacts.first_name || ''} ${deal.contacts.last_name || ''}`.trim() || 'Unnamed Client';
    };

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading board...</div>;
    }

    return (
        <div className="flex h-[calc(100vh-200px)] gap-4 overflow-x-auto pb-4">
            {pipeline.stages.map((stage) => (
                <div
                    key={stage.id}
                    className="flex-shrink-0 w-56 flex flex-col bg-muted/30 rounded-lg border"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage.id)}
                >
                    <div className={`p-3 border-b bg-background/50 rounded-t-lg flex justify-between items-center sticky top-0 backdrop-blur-sm`}>
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${stage.color.split(' ')[0].replace('text-', 'bg-')}`} />
                            <span className="font-semibold text-sm">{stage.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                            {columns[stage.id]?.length || 0}
                        </Badge>
                    </div>

                    <ScrollArea className="flex-1 p-2">
                        <div className="space-y-2">
                            {columns[stage.id]?.map((deal) => (
                                <Card
                                    key={deal.id}
                                    className="cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, deal.id)}
                                    onClick={() => navigate(`/contacts/${deal.contact_id}?tab=deals`)}
                                >
                                    <CardHeader className="p-3 pb-1 space-y-1">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-5">
                                                {deal.type}
                                            </Badge>
                                            {deal.ai_hot && (
                                                <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
                                                    🔥 {deal.ai_hot_score}
                                                </span>
                                            )}
                                        </div>
                                        <CardTitle className="text-sm font-medium leading-tight">
                                            {getClientName(deal)}
                                        </CardTitle>
                                        <div className="text-xs text-muted-foreground">
                                            {deal.budget_min ? `€${deal.budget_min.toLocaleString()}` : 'No Budget'}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-1">
                                        <div className="text-[10px] text-muted-foreground mt-1">
                                            {getAgentName(deal.primary_agent_id)}
                                        </div>
                                        {deal.areas && deal.areas.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {deal.areas.slice(0, 2).map((area, i) => (
                                                    <span key={i} className="text-[10px] bg-secondary px-1 rounded text-secondary-foreground">
                                                        {area}
                                                    </span>
                                                ))}
                                                {deal.areas.length > 2 && (
                                                    <span className="text-[10px] text-muted-foreground">+{deal.areas.length - 2}</span>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            ))}
        </div>
    );
};
