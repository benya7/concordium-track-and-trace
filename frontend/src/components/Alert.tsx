import { AlertCircle } from 'lucide-react';

import { Alert as AlertContainer, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
    destructive?: boolean;
    title: string;
    description: React.ReactNode;
}

export function Alert({ destructive = false, title, description }: Props) {
    return (
        <AlertContainer className="my-2 bg-background w-96 min-h-20 max-h-96 shadow overflow-hidden text-ellipsis" variant={destructive ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
        </AlertContainer>
    );
}
