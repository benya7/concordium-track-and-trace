import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { WalletConnection } from '@concordium/wallet-connectors';
import {
    AccountAddress,
    TransactionHash,
    TransactionKindString,
    TransactionSummaryType,
    UpdatedEvent,
} from '@concordium/web-sdk';
import { useGrpcClient } from '@concordium/react-components';

import * as constants from '@/constants';
import { TxHashLink } from '@/components/TxHashLink';
import { createItem } from '@/track_and_trace_contract';
import * as TrackAndTraceContract from '../../generated/module_track_and_trace';
import { fetchJson, FromTokenIdU64, getLocation, objectToBytes } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/Alert';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { InputImageFile } from '@/components/InputImageFile';
import { LocationPicker } from '@/components/LocationPicker';
import { LocationDetector } from '@/components/LocationDetector';
import { PinataSDK } from 'pinata-web3';
import { Loader2 } from 'lucide-react';
import { useAlertMsg } from '@/hooks/use-alert-msg';

interface Props {
    connection: WalletConnection | undefined;
    accountAddress: string | undefined;
    activeConnectorError: string | undefined;
    pinata: PinataSDK;
}

interface PartialItemCreatedEvent {
    item_id: string;
}

export function AdminCreateItem(props: Props) {
    const { connection, accountAddress, activeConnectorError, pinata } = props;

    interface FormType {
        url: string;
        location: string;
        productImages: File[];
    }
    const form = useForm<FormType>({
        mode: 'all',
        defaultValues: { url: '', location: '', productImages: [] },
    });
;
    const {message: txHash, setMessage: setTxHash} = useAlertMsg(12000);
    const {message: errorMessage, setMessage: setErrorMessage} = useAlertMsg();
    const {message: newItemId, setMessage: setNewItemId} = useAlertMsg(18000);

    const [isLoading, setIsLoading] = useState(false);
    const grpcClient = useGrpcClient(constants.NETWORK);

    // Wait until the submitted transaction is finalized.
    // Once the transaction is finalized, extract the
    // newly created ItemIndex from the event emitted within the transaction.
    useEffect(() => {
        if (connection && grpcClient && txHash !== undefined) {
            grpcClient
                .waitForTransactionFinalization(TransactionHash.fromHexString(txHash))
                .then((report) => {
                    if (
                        report.summary.type === TransactionSummaryType.AccountTransaction &&
                        report.summary.transactionType === TransactionKindString.Update
                    ) {
                        const eventList = report.summary.events[0] as UpdatedEvent;

                        const parsedEvent = TrackAndTraceContract.parseEvent(eventList.events[0]);
                        const itemCreatedEvent = parsedEvent.content as unknown as PartialItemCreatedEvent;

                        // The `item_id` is of type `TokenIdU64` in the smart contract and logged in the event as
                        // a little-endian hex string.
                        // E.g. the `TokenIdU64` representation of `1` is the hex string `0100000000000000`.
                        // This function converts the `TokenIdU64` representation into a bigint type here.
                        const itemId: bigint = FromTokenIdU64(itemCreatedEvent.item_id);
                        setNewItemId(itemId.toString());
                    } else {
                        setErrorMessage('Tansaction failed and event decoding failed.');
                    }
                    setIsLoading(false);
                })
                .catch((e) => {
                    setNewItemId(undefined);
                    setErrorMessage((e as Error).message);
                    setIsLoading(false);
                });
        }
    }, [connection, grpcClient, txHash]);

    function onDetectLocation() {
        getLocation(
            (location) => form.setValue('location', `${location.latitude},${location.longitude}`),
            (error) => setErrorMessage(error),
        );
    }

    function onSaveLocation(location: string) {
        form.setValue('location', location);
    }

    async function onSubmit(values: FormType) {
        setErrorMessage(undefined);
        if (accountAddress && connection) {
            setIsLoading(true);

            let metadata: Record<string, unknown> | undefined;
            let productImageCid: string | undefined;
            let productMetadataJsonCid: string | undefined;

            if (values.url !== '') {
                try {
                    metadata = await fetchJson(values.url);
                } catch (e) {
                    setErrorMessage((e as Error).message);
                    setIsLoading(false);
                    return;
                }
            }

            if (values.productImages.length > 0) {
                try {
                    productImageCid = (await pinata.upload.file(values.productImages[0])).IpfsHash;
                    if (metadata) {
                        metadata = {
                            ...metadata,
                            imageUrl: `ipfs://${productImageCid}`,
                        };
                    } else {
                        metadata = {
                            imageUrl: `ipfs://${productImageCid}`,
                        };
                    }
                } catch (e) {
                    setErrorMessage((e as Error).message);
                    setIsLoading(false);
                    return;
                }
            }

            if (metadata) {
                try {
                    productMetadataJsonCid = (await pinata.upload.json(metadata)).IpfsHash;
                } catch (e) {
                    setErrorMessage((e as Error).message);
                    setIsLoading(false);
                    return;
                }
            }

            const parameter: TrackAndTraceContract.CreateItemParameter = {
                additional_data: {
                    bytes: values.location !== '' ? objectToBytes({ location: values.location }) : [],
                },
                metadata_url: productMetadataJsonCid
                    ? {
                          type: 'Some',
                          content: {
                              url: `ipfs://${productMetadataJsonCid}`,
                              hash: { type: 'None' },
                          },
                      }
                    : {
                          type: 'None',
                      },
            };

            try {
                const txHash = await createItem(connection, AccountAddress.fromBase58(accountAddress), parameter);
                setTxHash(txHash);
                form.reset();
            } catch (e) {
                setErrorMessage((e as Error).message);
                setIsLoading(false);
            }
        } else {
            setErrorMessage(`Wallet is not connected. Click 'Connect Wallet' button.`);
        }
    }

    return (
        <div className="h-full w-full flex flex-col items-center py-16 px-2">
            <Card className="w-full max-w-md ">
                <CardHeader>
                    <CardTitle>Add New Product</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="url"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>URL</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter the metadata URL" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Location</FormLabel>
                                        <FormControl>
                                            <div className="flex w-full items-center space-x-1">
                                                <Input placeholder="Enter the location coordinates" {...field} />
                                                <LocationDetector onDetectLocation={onDetectLocation} />
                                                <LocationPicker onSaveLocation={onSaveLocation} />
                                            </div>
                                        </FormControl>
                                        <FormDescription>
                                            Use the &quot;latitude,longitude&quot; format.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <InputImageFile onChange={(imageFiles) => form.setValue('productImages', imageFiles)} />
                            <Button type="submit" className="w-20" disabled={isLoading}>
                                {isLoading ? <Loader2 className="animate-spin" /> : 'Create'}
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
                        title="Transaction Hash"
                        description={
                            <>
                                <TxHashLink txHash={txHash} />
                                <p>You will see the item id below after the transaction is finalized.</p>
                            </>
                        }
                    />
                )}
                {newItemId !== undefined && <Alert title="New Item" description={`Item ID: ${newItemId.toString()}`} />}
            </div>
        </div>
    );
}
