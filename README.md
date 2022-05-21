<p align="center">
  <img width="100px" src="https://github.com/SpaceBudz/spacebudz/raw/main/src/images/brand/logo.png" align="center" alt="GitHub Readme Stats" />
  <h1 align="center">SpaceBudz API</h1>
  <p align="center">The SpaceBudz API retrieves on-chain data from the marketplace. <a href="https://ogmios.dev/">Ogmios</a> is used to sync blocks from the chain and extracts all relevant data from blocks.</p>

  <p align="center">
    <img src="https://img.shields.io/github/commit-activity/m/SpaceBudz/spacebudz-api?style=for-the-badge" />
    <img src="https://img.shields.io/github/license/SpaceBudz/spacebudz-api?style=for-the-badge" />
    <a href="https://twitter.com/spacebudzNFT">
      <img src="https://img.shields.io/twitter/follow/spacebudzNFT?style=for-the-badge&logo=twitter" />
    </a>
  </p>

</p>

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

