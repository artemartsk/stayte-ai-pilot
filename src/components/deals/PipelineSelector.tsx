import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export interface Pipeline {
    id: string;
    name: string;
    stages: { id: string; name: string; color: string }[];
}

export const MOCK_PIPELINES: Pipeline[] = [
    {
        id: "default",
        name: "Sales Pipeline",
        stages: [
            { id: "new", name: "New", color: "bg-blue-100 text-blue-800 border-blue-200" },
            { id: "ai_contacting", name: "AI Contacting", color: "bg-purple-100 text-purple-800 border-purple-200" },
            { id: "ai_connected", name: "AI Connected", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
            { id: "qualified", name: "Qualified", color: "bg-green-100 text-green-800 border-green-200" },
            { id: "viewing", name: "Viewing", color: "bg-teal-100 text-teal-800 border-teal-200" },
            { id: "offer", name: "Offer", color: "bg-amber-100 text-amber-800 border-amber-200" },
            { id: "negotiation", name: "Negotiation", color: "bg-orange-100 text-orange-800 border-orange-200" },
            { id: "won", name: "Won", color: "bg-emerald-500 text-white border-transparent" },
            { id: "lost", name: "Lost", color: "bg-red-100 text-red-800 border-red-200" },
        ],
    },
    {
        id: "rental",
        name: "Rental Pipeline",
        stages: [
            { id: "new", name: "New Inquiry", color: "bg-blue-100 text-blue-800 border-blue-200" },
            { id: "screening", name: "Screening", color: "bg-purple-100 text-purple-800 border-purple-200" },
            { id: "viewing", name: "Viewing", color: "bg-teal-100 text-teal-800 border-teal-200" },
            { id: "application", name: "Application", color: "bg-amber-100 text-amber-800 border-amber-200" },
            { id: "lease_sent", name: "Lease Sent", color: "bg-orange-100 text-orange-800 border-orange-200" },
            { id: "signed", name: "Signed", color: "bg-emerald-500 text-white border-transparent" },
            { id: "rejected", name: "Rejected", color: "bg-red-100 text-red-800 border-red-200" },
        ],
    },
];

interface PipelineSelectorProps {
    selectedPipelineId: string;
    onPipelineChange: (pipelineId: string) => void;
}

export const PipelineSelector = ({
    selectedPipelineId,
    onPipelineChange,
}: PipelineSelectorProps) => {
    return (
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Pipeline:</span>
            <Select value={selectedPipelineId} onValueChange={onPipelineChange}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                    {MOCK_PIPELINES.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};
