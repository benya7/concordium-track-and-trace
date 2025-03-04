import moment from 'moment';
import { BrowserWalletConnector, WalletConnectConnector, ephemeralConnectorType} from '@concordium/react-components';
import { ContractAddress } from '@concordium/web-sdk';
import { TESTNET, MAINNET, CONCORDIUM_WALLET_CONNECT_PROJECT_ID } from '@concordium/wallet-connectors';
import { SignClientTypes } from '@walletconnect/types';

const { protocol, hostname, port } = new URL(CONFIG.node);

export const NODE_HOST = `${protocol}//${hostname}`;
export const NODE_PORT = Number(port);

export const SPONSORED_TRANSACTION_BACKEND = CONFIG.sponsoredTransactionBackend;

export const REFRESH_INTERVAL = moment.duration(2, 'seconds');

/** The contract address of the track and trace contract.  */
export const CONTRACT_ADDRESS = ContractAddress.fromSerializable(CONFIG.contractAddress);

/** The Concordium network used for the application. */
export const NETWORK = CONFIG.network === 'mainnet' ? MAINNET : TESTNET;

export const CCD_EXPLORER_URL =
    NETWORK === MAINNET ? 'https://ccdexplorer.io/mainnet' : 'https://ccdexplorer.io/testnet';

// Before submitting a transaction we simulate/dry-run the transaction to get an
// estimate of the energy needed for executing the transaction. In addition, we
// allow an additional small amount of energy `EPSILON_ENERGY` to be consumed by
// the transaction to cover small variations (e.g. changes to the smart contract
// state) caused by transactions that have been executed meanwhile.
export const EPSILON_ENERGY = 200n;
// const WALLET_CONNECT_PROJECT_ID = 'de4ecb78ceec18da50bb03f50de352b5';
const WALLET_CONNECT_OPTS: SignClientTypes.Options = {
    projectId: CONCORDIUM_WALLET_CONNECT_PROJECT_ID,
    // metadata: {
    //     name: 'Track and Trace V2',
    //     description: 'Track and trace products securely on Concordium blockchain',
    //     url: '#',
    //     icons: ['https://walletconnect.com/walletconnect-logo.png'],
    // },
};
export const BROWSER_WALLET = ephemeralConnectorType(BrowserWalletConnector.create);
export const WALLETCONNECT_WALLET = ephemeralConnectorType(WalletConnectConnector.create.bind(this, WALLET_CONNECT_OPTS));


export const SERIALIZATION_HELPER_SCHEMA_PERMIT_MESSAGE =
    'FAAFAAAAEAAAAGNvbnRyYWN0X2FkZHJlc3MMBQAAAG5vbmNlBQkAAAB0aW1lc3RhbXANCwAAAGVudHJ5X3BvaW50FgEHAAAAcGF5bG9hZBABAg==';

export const DAPP_NAME = 'Track & Trace';
