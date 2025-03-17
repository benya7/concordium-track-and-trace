import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Buffer } from 'buffer/';
import JSONbig from 'json-bigint';

import { WalletConnection, typeSchemaFromBase64 } from '@concordium/wallet-connectors';
import { useGrpcClient } from '@concordium/react-components';
import { AccountAddress, AccountTransactionSignature, Parameter, Timestamp } from '@concordium/web-sdk';
import { TxHashLink } from '@/components/TxHashLink';
import * as constants from '@/constants';
import { getItemState, nonceOf } from '@/track_and_trace_contract';
import * as TrackAndTraceContract from '../../generated/module_track_and_trace'; // Code generated from a smart contract module. The naming convention of the generated file is `moduleName_smartContractName`.
import { ToTokenIdU64, fetchJson, getExpiryTime, getLocation, objectToBytes, getDataFromIPFS, bytesToObject, parseCoordinates, parseUrlOrCid } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/Alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LocationPicker } from '@/components/LocationPicker';
import { LocationDetector } from '@/components/LocationDetector';
import { PinataSDK } from 'pinata-web3';
import { Loader2 } from 'lucide-react';
import { ChangeItem, CreateItem, getItemCreatedEvent, getItemStatusChangedEvents, ItemStatus } from '@/lib/itemEvents';
import { InputImageFile } from '@/components/InputImageFile';
import { useAlertMsg } from '@/hooks/use-alert-msg';
import { LatLngExpression } from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Circle } from 'react-leaflet';
import { Spinner } from '@/components/ui/spinner';
import { JsonView, allExpanded, defaultStyles } from 'react-json-view-lite';

interface Props {
    connection: WalletConnection | undefined;
    accountAddress: string | undefined;
    activeConnectorError: string | undefined;
    pinata: PinataSDK;
}

const NEW_STATUS_OPTIONS = [
    { label: 'Produced', value: 'Produced' },
    { label: 'InTransit', value: 'InTransit' },
    { label: 'InStore', value: 'InStore' },
    { label: 'Sold', value: 'Sold' },
];

function generateMessage(
    itemID: number | bigint,
    expiryTimeSignature: Date,
    nonce: number | bigint,
    newStatus: ItemStatus,
    newMetadataUrl: string | undefined,
    newLocation: string | undefined,
) {
    try {
        // if (newStatus === '') {
        //     throw Error(`'newStatus' input field is undefined`);
        // }

        // The `item_id` is of type `TokenIdU64` in the smart contract which is represented as a little-endian hex string.
        // E.g. the `TokenIdU64` representation of `1` is the hex string `0100000000000000`.
        const tokenIdU64 = ToTokenIdU64(itemID);

        // Create ChangeItemStatus parameter
        const changeItemStatusParameter: TrackAndTraceContract.ChangeItemStatusParameter = {
            additional_data: {
                bytes: newLocation ? objectToBytes({ location: newLocation }) : [],
            },
            item_id: tokenIdU64,
            new_status: {
                type: newStatus,
            },
            new_metadata_url: newMetadataUrl
                ? {
                    type: 'Some',
                    content: { url: newMetadataUrl, hash: { type: 'None' } },
                }
                : { type: 'None' },
        };

        const payload = TrackAndTraceContract.createChangeItemStatusParameter(changeItemStatusParameter);

        const message: TrackAndTraceContract.SerializationHelperParameter = {
            contract_address: constants.CONTRACT_ADDRESS,
            nonce: Number(nonce),
            timestamp: Timestamp.fromDate(expiryTimeSignature),
            entry_point: 'changeItemStatus',
            payload: Array.from(payload.buffer),
        };

        const serializedMessage = TrackAndTraceContract.createSerializationHelperParameter(message);

        return [payload, serializedMessage];
    } catch (error) {
        throw new Error(`Generating message failed. Orginal error: ${(error as Error).message}`);
    }
}

export function ChangeItemStatus(props: Props) {
    const { connection, accountAddress, activeConnectorError, pinata } = props;

    interface FormType {
        itemID: string;
        newLocation: string;
        newStatus: ItemStatus;
        newMetadataUrl: string;
        productImages: File[];
    }

    const form = useForm<FormType>({
        mode: 'all',
        defaultValues: {
            itemID: '',
            newLocation: '',
            newStatus: 'Produced',
            newMetadataUrl: '',
            productImages: [],
        },
    });
    const itemIDWatch = useWatch({ name: 'itemID', control: form.control });
    const [isLoading, setIsLoading] = useState(false);
    const { message: txHash, setMessage: setTxHash } = useAlertMsg(12000);
    const { message: errorMessage, setMessage: setErrorMessage } = useAlertMsg();

    const [nextNonce, setNextNonce] = useState<number | bigint>(0);
    const [isEditing, setIsEditing] = useState(false);
    const [itemChanged, setItemChanged] = useState<ChangeItem[] | undefined>(undefined);
    const [itemCreated, setItemCreated] = useState<CreateItem | undefined>(undefined);
    const [productStatus, setProductStatus] = useState<ItemStatus | undefined>(undefined);
    const [productImageUrl, setProductImageUrl] = useState<string | undefined>(undefined);
    const [productMetadata, setProductMetadata] = useState<Record<string, unknown> | undefined>(undefined);

    const [loadingImageUrl, setLoadingImageUrl] = useState(false);
    const grpcClient = useGrpcClient(constants.NETWORK);

    /**
     * This function querries the nonce (CIS3 standard) of an acccount in the track-and-trace contract.
     */
    const refreshNonce = useCallback(() => {
        if (grpcClient && accountAddress) {
            const nonceOfParam: TrackAndTraceContract.NonceOfParameter = [AccountAddress.fromBase58(accountAddress)];

            nonceOf(nonceOfParam)
                .then((nonceValue: TrackAndTraceContract.ReturnValueNonceOf) => {
                    if (nonceValue !== undefined) {
                        console.log("Fetched nonce:", nonceValue[0]);
                        setNextNonce(nonceValue[0]);
                    }
                })
                .catch((e) => {
                    setErrorMessage((e as Error).message);
                    setNextNonce(0);
                });
        }
    }, [grpcClient, accountAddress]);

    useEffect(() => {
        refreshNonce();
        // Refresh the next nonce value periodically.
        const interval = setInterval(refreshNonce, constants.REFRESH_INTERVAL.asMilliseconds());
        return () => clearInterval(interval);
    }, [refreshNonce]);

    function onDetectLocation() {
        getLocation(
            (location) => form.setValue('newLocation', `${location.latitude},${location.longitude}`),
            (error) => setErrorMessage(error),
        );
    }

    function onSaveLocation(location: string) {
        form.setValue('newLocation', location);
    }

    const tracePath = useMemo<LatLngExpression[] | undefined>(() => {
        if (!itemCreated) {
            return;
        }
        const coordinates: LatLngExpression[] = [];

        if (itemCreated.additional_data.bytes.length > 0) {
            const locationRaw = bytesToObject<{ location: string | undefined }>(
                itemCreated.additional_data.bytes,
            ).location;
            if (locationRaw) {
                coordinates.push(parseCoordinates(locationRaw));
            }
        }

        if (itemChanged && itemChanged.length > 0) {
            itemChanged.forEach((item) => {
                if (item.additional_data.bytes.length > 0) {
                    const locationRaw = bytesToObject<{ location: string | undefined }>(
                        item.additional_data.bytes,
                    ).location;
                    if (locationRaw) {
                        coordinates.push(parseCoordinates(locationRaw));
                    }
                }
            });
        }
        return coordinates;
    }, [itemChanged, itemCreated]);

    useEffect(() => {
        setIsEditing(false)
        setProductImageUrl(undefined);
        setItemChanged(undefined);
        setItemCreated(undefined);
        form.setValue('newStatus', 'Produced')
        setProductStatus('Produced')
    }, [itemIDWatch])

    async function onSearch() {
        setErrorMessage(undefined);
        setItemChanged(undefined);
        setItemCreated(undefined);

        if (itemIDWatch === '') {
            setErrorMessage(`'itemID' input field is undefined`);
            throw Error(`'itemID' input field is undefined`);
        }
        try {
            await getItemCreatedEvent(Number(itemIDWatch), setItemCreated);
            await getItemStatusChangedEvents(Number(itemIDWatch), setItemChanged);

            const itemState = await getItemState(ToTokenIdU64(Number(itemIDWatch)));
            form.setValue('newStatus', itemState.status.type)
            setProductStatus(itemState.status.type)
            if (itemState.metadata_url.type === 'Some') {
                const productJsonMetadata = await getDataFromIPFS(itemState.metadata_url.content.url, pinata);
                if (productJsonMetadata && productJsonMetadata.contentType === 'application/json') {
                    setProductMetadata(productJsonMetadata.data as unknown as Record<string, unknown>)
                    const { imageUrl } = productJsonMetadata.data as unknown as {
                        [key: string]: unknown;
                        imageUrl?: string;
                    }
                    if (imageUrl) {
                        setProductImageUrl(`https://ipfs.io/ipfs/${parseUrlOrCid(imageUrl)}`)
                    }
                }
            }
        } catch (error) {
            setErrorMessage(`Couldn't get data from database. Orginal error: ${(error as Error).message}`);
        }
    }
    async function onUpdateItem(values: FormType) {
        setTxHash(undefined);
        setErrorMessage(undefined);

        if (!connection || !accountAddress) {
            setErrorMessage(`Wallet is not connected. Click 'Connect Wallet' button.`);
            return;
        }

        setIsLoading(true);
        try {
            const expiryTimeSignature = getExpiryTime(1);
            const newMetadataUrl = await handleMetadata(values);

            const [payload, serializedMessage] = generateMessage(
                Number(itemIDWatch),
                expiryTimeSignature,
                nextNonce,
                values.newStatus,
                newMetadataUrl,
                values.newLocation || undefined,
            );

            const permitSignature = await connection.signMessage(accountAddress, {
                type: 'BinaryMessage',
                value: Buffer.from(serializedMessage.buffer),
                schema: typeSchemaFromBase64(constants.SERIALIZATION_HELPER_SCHEMA_PERMIT_MESSAGE),
            });
            console.log("Submitting with nonce:", nextNonce);
            const txHash = await submitTransaction(
                payload,
                permitSignature,
                expiryTimeSignature,
                nextNonce,
                accountAddress,
            );

            setTxHash(txHash);
            form.reset();
        } catch (e) {
            setErrorMessage((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleMetadata(values: FormType): Promise<string | undefined> {
        if (!values.newMetadataUrl && values.productImages.length === 0) {
            return undefined;
        }

        let newMetadata = values.newMetadataUrl
            ? await fetchJson(values.newMetadataUrl)
            : {};

        const itemState = await getItemState(ToTokenIdU64(Number(itemIDWatch)));
        if (itemState.metadata_url.type === "Some") {
            const productJsonMetadata = await getDataFromIPFS(itemState.metadata_url.content.url, pinata);

            if (productJsonMetadata && productJsonMetadata.contentType === 'application/json') {
                const productMetadata = productJsonMetadata.data as unknown as {
                    [key: string]: unknown;
                    imageUrl?: string;
                };
                newMetadata = structuredClone({
                    ...productMetadata,
                    ...newMetadata,
                });
            }
        }

        if (values.productImages.length > 0) {
            try {
                const productImageCid = (await pinata.upload.file(values.productImages[0])).IpfsHash;
                newMetadata = structuredClone({
                    ...newMetadata,
                    imageUrl: `ipfs://${productImageCid}`,
                });
            } catch (error) {
                console.error('Failed to upload product image:', error);
                throw new Error('Image upload failed');
            }
        }

        try {
            const productJsonMetadataCid = (await pinata.upload.json(newMetadata)).IpfsHash;
            return `ipfs://${productJsonMetadataCid}`;
        } catch (error) {
            console.error('Failed to upload metadata JSON:', error);
            throw new Error('Metadata upload failed');
        }
    }

    async function submitTransaction(
        payload: Parameter.Type,
        permitSignature: AccountTransactionSignature,
        expiryTime: Date,
        nonce: number | bigint,
        signer: string,
    ): Promise<string> {
        const body = {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSONbig.stringify({
                signer,
                nonce,
                signature: permitSignature[0][0],
                expiryTime: expiryTime.toISOString(),
                contractAddress: constants.CONTRACT_ADDRESS,
                contractName: TrackAndTraceContract.contractName.value,
                entrypointName: 'changeItemStatus',
                parameter: Buffer.from(payload.buffer).toString('hex'),
            }),
        }
        console.log("Request body:", body);
        const response = await fetch(constants.SPONSORED_TRANSACTION_BACKEND + `api/submitTransaction`, body);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Unable to get txHash from backend: ${JSON.stringify(error)}`);
        }
        return response.json();
    }

    return (
        <div className="h-full w-full flex flex-col items-center py-16 px-2">
            <Card className="w-full sm:max-w-md mb-4">
                <CardHeader>
                    <CardTitle>Update The Product Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onUpdateItem)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="itemID"
                                rules={{ required: 'Item ID is required' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Item ID</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="Enter the tracking number ID"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button onClick={onSearch} className="w-20" type='button'>Search</Button>

                            {isEditing && (
                                <>
                                    <FormField
                                        control={form.control}
                                        name="newLocation"
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
                                    <FormField
                                        control={form.control}
                                        name="newStatus"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>New Status</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a verified email to display" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {NEW_STATUS_OPTIONS.map((opt) => (
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
                                        name="newMetadataUrl"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>New Metadata URL</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Enter the metadata URL" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <InputImageFile onChange={(imageFiles) => form.setValue('productImages', imageFiles)} />
                                    <Button onClick={() => setIsEditing(false)} className="w-20 mr-2" type='button'>Cancel</Button>
                                    <Button type="submit" className="w-20" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="animate-spin" /> : 'Save'}
                                    </Button>
                                </>
                            )}
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
                {txHash && <Alert title="Transaction Hash" description={<TxHashLink txHash={txHash} />} />}
            </div>
            {!isEditing && itemChanged !== undefined && itemCreated !== undefined && (
                <div className="grid md:grid-cols-2 gap-1 w-full max-w-2xl p-2 border rounded-lg">
                    <div className="relative border rounded-lg">
                        {productImageUrl ? (
                            <img
                                src={productImageUrl}
                                alt="product-image"
                                className="h-60 mx-auto"
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center min-h-60">
                                {loadingImageUrl ? <Spinner show={loadingImageUrl} /> : <p className="text-[0.8rem] text-muted-foreground">No product images avalaible.</p>}
                            </div>
                        )}
                    </div>
                    <div className="relative border rounded-lg">
                        {tracePath && tracePath.length > 0 ? (
                            <MapContainer center={tracePath.at(-1)!} zoom={8} className="h-60">
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <Circle center={tracePath.at(0)!} pathOptions={{ fillColor: 'green' }} radius={20} />
                                <CircleMarker center={tracePath.at(0)!} pathOptions={{ color: 'green' }} radius={20}>
                                    <Popup>Origin</Popup>
                                </CircleMarker>
                                <Circle center={tracePath.at(-1)!} pathOptions={{ fillColor: 'red' }} radius={20} />
                                <CircleMarker center={tracePath.at(-1)!} pathOptions={{ color: 'red' }} radius={20}>
                                    <Popup>Current</Popup>
                                </CircleMarker>
                                <Polyline pathOptions={{ color: 'blue' }} positions={tracePath} />
                            </MapContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-[0.8rem] text-muted-foreground">No tracking locations avalaible.</p>
                            </div>
                        )}
                    </div>
                    <div className="md:col-span-2 border-t mt-2 min-h-24 max-w-full overflow-x-auto">
                        <p className='my-2'>Status: {productStatus}</p>
                        {productMetadata ? (<JsonView data={productMetadata as object} shouldExpandNode={allExpanded} style={{ ...defaultStyles, container: `${defaultStyles.container} py-2` }} />) : (<div className="h-full flex items-center justify-center">
                            <p className="text-[0.8rem] text-muted-foreground">No product metadata avalaible.</p>
                        </div>)}

                    </div>
                    <Button onClick={() => {
                        setIsEditing(true)
                    }} className="w-20 mt-2" type='button'>Edit</Button>
                </div>

            )}
        </div>
    );
}
