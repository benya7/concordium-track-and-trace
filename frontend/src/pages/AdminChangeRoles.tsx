import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { WalletConnection } from '@concordium/wallet-connectors';
import { AccountAddress, TransactionHash, TransactionKindString, TransactionSummaryType } from '@concordium/web-sdk';

import { TxHashLink } from '@/components/TxHashLink';
import { addRole, removeRole, getAddressesByRole } from '@/track_and_trace_contract';
import * as TrackAndTraceContract from '../../generated/module_track_and_trace';
import { validateAccountAddress } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/Alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ReturnValueGetAddressesByRole } from '../../generated/module_track_and_trace';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, LucideTrash } from 'lucide-react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useAlertMsg } from '@/hooks/use-alert-msg';
import { useGrpcClient } from '@concordium/react-components';
import { NETWORK } from '@/constants';

interface Props {
    connection: WalletConnection | undefined;
    accountAddress: string | undefined;
    activeConnectorError: string | undefined;
}

export function AdminChangeRoles(props: Props) {
    const { connection, accountAddress, activeConnectorError } = props;

    interface FormType {
        address: string;
    }
    const form = useForm<FormType>({
        mode: 'all',
        defaultValues: {
            address: '',
        },
    });

    const { message: txHash, setMessage: setTxHash } = useAlertMsg(12000);
    const { message: errorMessage, setMessage: setErrorMessage } = useAlertMsg();
    const [currentAdmins, setCurrentAdmins] = useState<ReturnValueGetAddressesByRole | undefined>();
    const grpcClient = useGrpcClient(NETWORK);
    const [isLoading, setIsLoading] = useState(false);
    function refreshAdminsList() {
        const parameter: TrackAndTraceContract.GetAddressesByRoleParameter = {
            type: 'Admin',
        };
        getAddressesByRole(parameter)
            .then((result) => {
                setCurrentAdmins(result);
            })
            .catch((e) => {
                setErrorMessage((e as Error).message);
            });
    }

    useEffect(() => {
        refreshAdminsList()
    }, []);

    useEffect(() => {
        if (connection && grpcClient && txHash !== undefined) {
            grpcClient
                .waitForTransactionFinalization(TransactionHash.fromHexString(txHash))
                .then((report) => {
                    if (
                        report.summary.type === TransactionSummaryType.AccountTransaction &&
                        report.summary.transactionType === TransactionKindString.Update
                    ) {
                        refreshAdminsList()
                    } else {
                        setErrorMessage('Tansaction failed and event decoding failed.');
                    }
                })
                .catch((e) => {
                    setErrorMessage((e as Error).message);
                })
                .finally(() => {
                    form.reset()
                    setIsLoading(false);
                })
        }
    }, [connection, grpcClient, txHash]);

    function handleRemoveRole(address: string) {
        const parameter: TrackAndTraceContract.RevokeRoleParameter = {
            address: { type: 'Account', content: AccountAddress.fromBase58(address) },
            role: { type: 'Admin' },
        };

        if (accountAddress && connection) {
            // Send transaction
            removeRole(connection, AccountAddress.fromBase58(accountAddress), parameter)
                .then((txHash: string) => {
                    setTxHash(txHash);
                    setIsLoading(true);
                })
                .catch((e) => {
                    setErrorMessage((e as Error).message);
                });
        } else {
            setErrorMessage(`Wallet is not connected. Click 'Connect Wallet' button.`);
        }
    }
    function onSubmit(values: FormType) {
        setErrorMessage(undefined);

        if (values.address === '') {
            setErrorMessage(`'address' input field is undefined`);
            throw Error(`'address' input field is undefined`);
        }

        const parameter: TrackAndTraceContract.GrantRoleParameter = {
            address: {
                type: 'Account',
                content: AccountAddress.fromBase58(values.address),
            },
            role: { type: 'Admin' },
        };

        if (accountAddress && connection) {
            // Send transaction
            addRole(connection, AccountAddress.fromBase58(accountAddress), parameter)
                .then((txHash: string) => {
                    setTxHash(txHash);
                    setIsLoading(true);
                })
                .catch((e) => {
                    setErrorMessage((e as Error).message);
                });
        } else {
            setErrorMessage(`Wallet is not connected. Click 'Connect Wallet' button.`);
        }
    }
    return (
        <div className="h-full w-full flex flex-col items-center py-16 px-2">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Grant Admin Role to an Address</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="address"
                                rules={{
                                    required: 'Address is required',
                                    validate: validateAccountAddress,
                                }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Address</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="4bbdAUCDK2D6cUvUeprGr4FaSaHXKuYmYVjyCa4bXSCu3NUXzA"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-20" disabled={isLoading}>
                                {isLoading ? <Loader2 className="animate-spin" /> : 'Add'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            <Table className="max-w-2xl mx-auto mt-8 border-t">
                <TableHeader>
                    <TableRow>
                        <TableHead className="flex-1">Address</TableHead>
                        <TableHead>Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentAdmins ? (
                        currentAdmins.map((admin, parentIndex) => (
                            <TableRow key={parentIndex}>
                                <TableCell>
                                    <p>{admin.content.toString()}</p>
                                </TableCell>
                                <TableCell>
                                    <Dialog>
                                        <DialogTrigger>
                                            <Button>
                                                <LucideTrash />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Are you sure?</DialogTitle>
                                                <DialogDescription className="py-4">
                                                    {`This will revoke Admin role to the account ${admin.content.toString()}.`}
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter>
                                                <DialogClose className="space-x-2">
                                                    <Button>Cancel</Button>
                                                    <Button
                                                        className="bg-blue-500"
                                                        onClick={() => handleRemoveRole(admin.content.toString())}
                                                    >
                                                        Confirm
                                                    </Button>
                                                </DialogClose>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <p>No admins found.</p>
                    )}
                </TableBody>
            </Table>
            <div className="fixed bottom-4">
                {errorMessage && <Alert destructive title="Error" description={errorMessage} />}
                {activeConnectorError && (
                    <Alert
                        destructive
                        title="Connect Error"
                        description={
                            <>
                                <p>{activeConnectorError}</p>
                                <p>Refresh page if you have the browser wallet installed.</p>
                            </>
                        }
                    />
                )}
                {txHash && <Alert title="Transaction Result" description={<TxHashLink txHash={txHash} />} />}
            </div>
        </div>
    );
}
