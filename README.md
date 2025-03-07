# Track and Trace Project

## Hosted front end

[Hosted front end link](http://13.36.39.166:8080/)

## Overview

This project contains a complete implementation of a track and trace solution with [CIS-3](https://proposals.concordium.software/CIS/cis-3.html) compliant sponsored transactions.

It has five primary components.

- A [smart contract](./smart-contract/README.md), located in `./smart-contract`
- A [frontend](./frontend/README.md), located in `./frontend`
- An [indexer](./indexer/README.md) service, located in `./indexer`
- A [sponsored transaction service](./sponsored-transaction-service/README.md), located in `./sponsored-transaction-service`
  - This service is generic and compatible with any CIS-3 contracts.
- A [server](./indexer/README.md) that hosts the frontend, located in `./indexer`

Explanations for each component reside in README.md files inside their respective folder.

You can run the services and servers manually as explained in the READMEs or use the docker files in `./dockerfiles`.

However, the easiest option is to use [docker-compose](https://docs.docker.com/compose/) with the configuration file `./docker-compose.yml`.

For this to work, you should do the following:

1. Deploy and initialize your version of the Track and Trace smart contract.
2. [Export your account keys from the Browser Wallet](https://developer.concordium.software/en/mainnet/net/guides/export-key.html) and generate a `./private-keys` folder to save the key file into it.
3. Create an account on [Pinata Cloud](https://pinata.cloud) and get your JWT and custom gateway URL.
4. Set the following environment variables:
   - Set the `TRACK_AND_TRACE_CONTRACT_ADDRESS` variable to the contract address of your contract instance.
   - Set the `TRACK_AND_TRACE_PRIVATE_KEY_FILE` variable to the path of your keys from step 2.
   - Set the `TRACK_AND_TRACE_PINATA_JWT=` variable to the JSON Web Token from the step 3.
   - Set the `TRACK_AND_TRACE_PINATA_GATEWAY=` variable to the URL Pinata gateway from the step 3.
   - (Optional) Set the `TRACK_AND_TRACE_NETWORK` variable to the correct net (testnet/mainnet). Defaults to testnet.
   - (Optional) Set the `TRACK_AND_TRACE_NODE` to the gRPC endpoint of the node you want to use. Make sure it runs on the right net, i.e., testnet or mainnet. Defaults to `https://grpc.testnet.concordium.com:20000`.
5. Run `docker-compose up` to build and start all the services.

e.g.

```bash
TRACK_AND_TRACE_CONTRACT_ADDRESS="<10382,0>" TRACK_AND_TRACE_PINATA_JWT="eyJhbGciOi.." TRACK_AND_TRACE_PINATA_GATEWAY=white-imaginative-squid-95.mypinata.cloud TRACK_AND_TRACE_PRIVATE_KEY_FILE="./private-keys/4SizPU2ipqQQza9Xa6fUkQBCDjyd1vTNUNDGbBeiRGpaJQc6qX.export" docker-compose up
```

You might need to run the above command twice, if the postgres database container is too slow
to be set up for the first time and as a result the indexer or server throw an error because
they are already trying to connect. Stopping the command and re-running the command will load
the already setup postgres database container.

5. Access the frontend at `http://localhost:8080`
   - The sponsored transaction service runs on port `8000` by default, and the postgres database runs on `5432`. Both are configurable in the `./docker-compose.yml` file.

## Switching to a different contract address

The indexer service saves the contract address used into the underlying PostgreSQL database.
If you want to use a different contract address than initially set up, you therefore need to delete the PostgreSQL database before running the `docker-compose up` command again.

To do so, run the following command:

``` shell
   docker volume rm trackandtrace_postgres_data
```

## Roles and Permissions

This "Track & Trace" application consists of a smart contract and a user interface (UI) designed to manage a supply chain workflow. The smart contract uses two distinct mechanisms to handle permissions: the `roles` mapping for administrative control and the `transitions` mapping for state machine operations. These permissions determine what actions **Admins** and **Non-Admins** can perform, both in the contract and through the UI sidebar options: `Explorer`, `New Item`, `Update Item`, `Roles`, and `Transition Rules`. Here’s how it all works:

### Admins

- **Who They Are**: Accounts with the `Admin` role, assigned during contract initialization (to the deployer) or later via `grantRole` by an existing admin.
- **What They Can Do in the Smart Contract**:
  - **Create Items**: Use `createItem` to add new items, starting with the `Produced` status.
  - **Manage Roles**: Call `grantRole` and `revokeRole` to add or remove admins.
  - **Configure State Machine**: Invoke `updateStateMachine` to define or modify allowed status transitions (e.g., who can move an item from `Produced` to `InTransit`).
  - **Update Statuses**: Change an item’s status via `changeItemStatus` or `permit`, but *only if* their address is authorized in the `transitions` mapping for that specific transition.
- **Key Note**: The `Admin` role alone doesn’t grant status-changing rights—transition permissions must be explicitly added via `updateStateMachine`.
- **UI Sidebar Access**:
  - **`Explorer`**: View all items and their statuses (read-only access, available to all users).
  - **`New Item`**: Create new items by submitting details like metadata URL and additional data, triggering `createItem`. Requires the `Admin` role.
  - **`Update Item`**: Update an item’s status (e.g., from `Produced` to `InTransit`), but only if the admin’s address has the necessary transition permissions in the contract.
  - **`Roles`**: Manage admin roles by granting or revoking the `Admin` role for other accounts, interacting with `grantRole` and `revokeRole`.
  - **`Transition Rules`**: Add or remove transition rules (e.g., authorizing an account to move items from `InStore` to `Sold`) by calling `updateStateMachine`.

### Non-Admins

- **Who They Are**: Accounts without the `Admin` role, such as workflow participants (e.g., `PRODUCER`, `TRANSPORTER`, `SELLER`).
- **What They Can Do in the Smart Contract**:
  - **Update Statuses**: Use `changeItemStatus` or `permit` to transition an item’s status (e.g., `Produced` → `InTransit`), provided their address is authorized in the `transitions` mapping for that transition.
- **Key Note**: Non-admins are limited to status updates they’re explicitly permitted to perform and have no administrative control over items, roles, or the state machine.
- **UI Sidebar Access**:
  - **`Explorer`**: View all items and their statuses (read-only access, available to all users).
  - **`New Item`**: Disabled—non-admins cannot create items, as this requires the `Admin` role.
  - **`Update Item`**: Update an item’s status if their account is authorized for that transition (e.g., a `TRANSPORTER` moving an item from `InTransit` to `InStore`).
  - **`Roles`**: Disabled—non-admins cannot manage roles.
  - **`Transition Rules`**: Disabled—non-admins cannot modify the state machine.

### How It Works Together

- **Smart Contract**:
  - Admins manage the system (creating items, roles, and transition rules), while both admins and non-admins can update statuses if authorized in `transitions`.
  - The `roles` mapping controls admin privileges, and the `transitions` mapping governs status updates for all accounts.
- **UI Sidebar**:
  - **`Explorer`**: A read-only overview of all items, accessible to everyone, showing item IDs, statuses, and metadata.
  - **`New Item`**: Exclusive to admins, allowing item creation with initial details.
  - **`Update Item`**: Available to any authorized account (admin or non-admin), based on `transitions`, for updating item statuses.
  - **`Roles`**: An admin-only section for managing who has the `Admin` role.
  - **`Transition Rules`**: An admin-only tool to configure the state machine, defining who can perform which status transitions.

This design separates administrative control from workflow execution, ensuring flexibility and security in tracking items through the supply chain.
