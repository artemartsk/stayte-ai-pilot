import { Badge } from '@/components/ui/badge';

interface GroupBadgeProps {
    name: string;
    color?: string;
    className?: string;
    children?: React.ReactNode;
}

export const GroupBadge = ({ name, color = '#3b82f6', className = '', children }: GroupBadgeProps) => {
    return (
        <Badge
            variant="outline"
            className={`text-xs ${className}`}
            style={{
                borderColor: color,
                backgroundColor: `${color}15`,
                color: color,
            }}
        >
            {name}
            {children}
        </Badge>
    );
};
