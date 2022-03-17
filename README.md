# SpaceBudz-API

The SpaceBudz-API retrieves on-chain data from the marketplace. [Ogmios](https://ogmios.dev/) is used to sync blocks from the chain and all relevant data are extracted from them.

### Requirements

- [Ogmios](https://ogmios.dev/)
- [Node.js](https://nodejs.org/en/) >= 14

### Get started

```shell
npm start
```

This will start syncing the chain. All relevant data are dumped into `/db/db.json`

#### Config

You can change the connection to the Ogmios server. The config is under `src/config.ts`

