import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { WalletConnection } from '@concordium/wallet-connectors';
import { AccountAddress } from '@concordium/web-sdk';

import { TxHashLink } from '@/components/TxHashLink';
import { updateStateMachine } from '@/track_and_trace_contract';
import * as TrackAndTraceContract from '../../generated/module_track_and_trace';
import { validateAccountAddress } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/Alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAlertMsg } from '@/hooks/use-alert-msg';
interface Props {
    connection: WalletConnection | undefined;
    accountAddress: string | undefined;
    activeConnectorError: string | undefined;
}

const STATE_OPTIONS = [
    { label: 'Produced', value: 'Produced' },
    { label: 'InTransit', value: 'InTransit' },
    { label: 'InStore', value: 'InStore' },
    { label: 'Sold', value: 'Sold' },
];

export function AddTransitionRule(props: Props) {
    const { connection, accountAddress, activeConnectorError } = props;

    interface FormType {
        address: string;
        fromStatus: 'Produced' | 'InTransit' | 'InStore' | 'Sold';
        toStatus: 'Produced' | 'InTransit' | 'InStore' | 'Sold';
        isUpdateAdd: boolean;
    }
    const form = useForm<FormType>({
        mode: 'all',
        defaultValues: {
            address: '',
            fromStatus: 'Produced',
            toStatus: 'InTransit',
            isUpdateAdd: true,
        },
    });

    const {message: txHash, setMessage: setTxHash} = useAlertMsg(12000);
    const {message: errorMessage, setMessage: setErrorMessage} = useAlertMsg();

    function onSubmit(values: FormType) {
        setErrorMessage(undefined);

        if (values.address === '') {
            setErrorMessage(`'address' input field is undefined`);
            throw Error(`'address' input field is undefined`);
        }

        // if (fromStatus === undefined) {
        //     setErrorMessage(`'from_status' input field is undefined`);
        //     throw Error(`'from_status' input field is undefined`);
        // }

        // if (toStatus === undefined) {
        //     setErrorMessage(`'to_status' input field is undefined`);
        //     throw Error(`'to_status' input field is undefined`);
        // }

        const parameter: TrackAndTraceContract.UpdateStateMachineParameter = {
            address: AccountAddress.fromBase58(values.address),
            to_status: { type: values.toStatus },
            from_status: { type: values.fromStatus },
            update: { type: values.isUpdateAdd ? 'Add' : 'Remove' },
        };

        // Send transaction
        if (accountAddress && connection) {
            updateStateMachine(connection, AccountAddress.fromBase58(accountAddress), parameter)
                .then((txHash: string) => {
                    setTxHash(txHash);
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
                    <CardTitle>Change Transition Rule</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="isUpdateAdd"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <div className="flex gap-2 items-center">
                                            <FormLabel>Add</FormLabel>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <FormLabel>Remove</FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="fromStatus"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>From Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a verified email to display" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {STATE_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="toStatus"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>To Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a verified email to display" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {STATE_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                            <Button type="submit" className="w-20">
                                Submit
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
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
                {txHash && (
                    <Alert
                        title="Transaction Result"
                        description={
                            <>
                                <TxHashLink txHash={txHash} />
                            </>
                        }
                    />
                )}
            </div>
        </div>
    );
}
