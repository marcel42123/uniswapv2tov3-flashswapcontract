# uniswapv2tov3-flashswapcontract
This repository is a technical implementation demonstrating how to utilize the Uniswap V2 Flash Swap protocol for zero-capital arbitrage, specifically made for the Arbitrum One (Ethereum L2) network. To maintain transparency, the execution logs and compiled bytecode can be verified directly on Arbiscan:

* **Deployed Contract:** `0xCBea17FAA7c69a9D0465b14A8a44dC83E9760D26`
* **Flash Swap tx:** `0x09ac0c86cd52a1ba89b198cceb5f97673cd8843df03893f3c7171d73f53d068e`

image of the swaps in a single block:
<img width="1303" height="190" alt="image" src="https://github.com/user-attachments/assets/031c37a3-ddc0-43aa-90c0-dff696c5d044" />

why flash swap?
* arbitrage require highspeed swaps to be ontop of others, to be able to complete a full swap within a single block provides a massive competitive advantage, particularly on networks with slower or variable block times.
* using zero capital means we dont run the risk of losing capital from negative swaps and slippages.

## ⚠️ Disclaimer
This `.sol` contract is a bare-bones implementation designed purely to demonstrate core flash swap mechanics. It lacks the advanced on-chain guardrails, real-time slippage tracking, and automated balance checks required to minimize losses in a competitive environment.
