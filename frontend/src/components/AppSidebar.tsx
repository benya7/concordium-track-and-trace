import { FileBox, PackageSearch, Combine, PackagePlus, Shield } from 'lucide-react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DAPP_NAME } from '@/constants';
import { ConnectorType, WalletConnector } from '@concordium/react-components';
import { useNavigate } from 'react-router-dom';
import { WalletConnectorDialog } from './WalletConnectorDialog';

const items = [
    {
        title: 'Explorer',
        url: '/',
        Icon: PackageSearch,
    },
    {
        title: 'New Item',
        url: '/item/create',
        Icon: PackagePlus,
    },
    {
        title: 'Update Item',
        url: '/item/update',
        Icon: FileBox,
    },
    {
        title: 'Roles',
        url: '/roles/change',
        Icon: Shield,
    },
    {
        title: 'Transition Rules',
        url: '/transition-rules/add',
        Icon: Combine,
    },
];

interface Props {
    disconnect: () => void;
    setActiveConnectorType: (type: ConnectorType | undefined) => void;
    account?: string;
}
export function AppSidebar({ disconnect, setActiveConnectorType, account }: Props) {
    const navigate = useNavigate();
    return (
        <Sidebar>
            <SidebarHeader>
                <h1 className="text-lg font-bold">{DAPP_NAME}</h1>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton onClick={() => navigate(item.url)}>
                                        <item.Icon />
                                        <span>{item.title}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                {account ? (
                    <div className="flex items-center justify-between">
                        <p>{account.slice(0, 5) + '...' + account.slice(-5)}</p>
                        <Button onClick={disconnect}>Disconnect</Button>
                    </div>
                ) : <WalletConnectorDialog setActiveConnectorType={setActiveConnectorType} />}
            </SidebarFooter>
        </Sidebar>
    );
}
