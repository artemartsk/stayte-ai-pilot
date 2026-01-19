import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

interface DealsTableProps {
    deals: Deal[];
    isLoading: boolean;
}

export const DealsTable = ({ deals, isLoading }: DealsTableProps) => {
    const navigate = useNavigate();

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading deals...</div>;
    }

    if (deals.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No deals found</div>;
    }

    return (
        <Card className="overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Deal ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {deals.map((deal) => (
                        <TableRow
                            key={deal.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/contacts/${deal.contact_id}`)}
                        >
                            <TableCell className="font-mono text-xs">{deal.id.slice(0, 8)}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className="capitalize">
                                    {deal.type}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="capitalize">
                                    {deal.status.replace('_', ' ')}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {deal.budget_min && deal.budget_max
                                    ? `€${deal.budget_min.toLocaleString()} - €${deal.budget_max.toLocaleString()}`
                                    : '-'}
                            </TableCell>
                            <TableCell>
                                {deal.created_at ? new Date(deal.created_at).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                                {deal.offer_price
                                    ? `€${deal.offer_price.toLocaleString()}`
                                    : deal.commission_value
                                        ? `Comm: €${deal.commission_value.toLocaleString()}`
                                        : '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
};
