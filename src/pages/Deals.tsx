import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DealsTable } from "@/components/deals/DealsTable";
import { DealsBoard } from "@/components/deals/DealsBoard";
import { PipelineSelector, MOCK_PIPELINES } from "@/components/deals/PipelineSelector";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

// type Deal = Database["public"]["Tables"]["deals"]["Row"];

const Deals = () => {
    const [viewMode, setViewMode] = useState<"table" | "board">("board");
    const [selectedPipelineId, setSelectedPipelineId] = useState("default");

    const { data: deals, isLoading: isLoadingDeals } = useQuery({
        queryKey: ["deals"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("deals")
                .select("*, contacts(first_name, last_name)")
                .order("created_at", { ascending: false });

            if (error) throw error;
            console.log("Fetched deals:", data);
            return data;
        },
    });

    const { data: members, isLoading: isLoadingMembers } = useQuery({
        queryKey: ["members"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("contact_profiles")
                .select("id, first_name, last_name, email");

            if (error) throw error;
            return data;
        },
    });

    const isLoading = isLoadingDeals || isLoadingMembers;


    const selectedPipeline = MOCK_PIPELINES.find(p => p.id === selectedPipelineId) || MOCK_PIPELINES[0];

    return (
        <div className="p-6 space-y-6 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
                    <p className="text-muted-foreground">Manage your sales pipeline and track deal progress.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Deal
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b pb-4">
                <PipelineSelector
                    selectedPipelineId={selectedPipelineId}
                    onPipelineChange={setSelectedPipelineId}
                />

                <div className="flex items-center bg-muted p-1 rounded-lg border">
                    <Button
                        variant={viewMode === "board" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("board")}
                        className="h-8 px-3"
                    >
                        <LayoutGrid className="h-4 w-4 mr-2" />
                        Board
                    </Button>
                    <Button
                        variant={viewMode === "table" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("table")}
                        className="h-8 px-3"
                    >
                        <List className="h-4 w-4 mr-2" />
                        Table
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                {viewMode === "board" ? (
                    <DealsBoard deals={deals || []} members={members || []} pipeline={selectedPipeline} isLoading={isLoading} />
                ) : (
                    <DealsTable deals={deals || []} isLoading={isLoading} />
                )}
            </div>
        </div>
    );
};

export default Deals;
