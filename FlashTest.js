import { ethers } from "ethers";

// Setup Provider & your Wallet (Must be the contract owner)
const PRIVATE_KEY = "_____";
const RPC_URL = "https://arb1.arbitrum.io/rpc"; // Arbitrum One public RPC
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Address of your deployed contract & uniswapv3 Router + address of tokens ill be using
const FlashBorrower_Address = "_____";
const V3_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";        //wrapped eth
const USDC_NATIVE = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; //native arbitrum usdc

// your contract and uniswap v3 ABIs
const FlashBorrower_Abi = [ "function FlashBorrow(address pair, uint256 amount0Out, uint256 amount1Out, bytes calldata data) external", "function withdrawToken(address token, uint256 amount) external", "function withdrawETH() external",];
const V3_ROUTER_ABI = ["function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"];

// uniswap v2 factory setup, to identify token pair's pool's address
const FACTORY = "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9";
const pairAbi = ["function token0() view returns (address)", "function token1() view returns (address)"];
const factoryAbi = [ "function getPair(address tokenA, address tokenB) external view returns (address)"];
const factory = new ethers.Contract( FACTORY, factoryAbi, provider);

// finding Weth - usdc pair's pool's address
const pair = await factory.getPair(WETH, USDC_NATIVE);
const pairContract = new ethers.Contract( pair, pairAbi, provider);
const token0 = await pairContract.token0();
const token1 = await pairContract.token1();
console.log(`pair: ${pair} | token0: ${token0} | token1: ${token1}`);

//==========================================================================================
async function executeFlashLoan() {
  // initiate contract and uniswap v3 router
  const flashBorrower = new ethers.Contract(FlashBorrower_Address, FlashBorrower_Abi, wallet);
  const routerInterface = new ethers.Interface(V3_ROUTER_ABI);

  // Setup the trade amount, minProfitUSDC isnt implemented in the sol contract
  /* the trade would be:
    borrow 0.0016 weth from uniswap v2,
    trade 0.0016 weth to usdc at uniswap v3,
    "calculate how much usdc+fee needed to pay back to uniswap v2"
    send the usdc required to uniswap v2,
    uniswap v2 trade the usdc back to weth to fulfil the return requirement
  */
  const borrowedAmount = BigInt(16 * 1e14)
  const minProfitUSDC = ethers.parseUnits("1.0", 6); // Require at least $1.00 USDC net profit

  // setup the swap data for uniswap v3 route
  const v3Params = {
    tokenIn: WETH,
    tokenOut: USDC_NATIVE,
    fee: 500, // 0.05% V3 fee tier
    recipient: FlashBorrower_Address, // Tokens MUST land back in flashBorrower contract
    amountIn: borrowedAmount,
    amountOutMinimum: 0, // Enforce slippage here if needed
    sqrtPriceLimitX96: 0
  };

  // setup the callback data in flash contract
  const routerData = routerInterface.encodeFunctionData("exactInputSingle", [v3Params]);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const callbackData = abiCoder.encode(
    ["address", "bytes", "address", "uint256"],
    [
      V3_ROUTER_ADDRESS,
      routerData,
      USDC_NATIVE, // We expect profit to accumulate in USDC
      minProfitUSDC
    ]
  );

  const amount0Out = borrowedAmount; // WETH is token0
  const amount1Out = 0n;

  try {
    // Static call checks for reverts locally before broadcasting to save gas
    console.log("Simulating flash loan via static call...");
    await flashBorrower.FlashBorrow.staticCall(
      pair,
      amount0Out,
      amount1Out,
      callbackData
    );
    console.log("Static call succeeded! Executing real transaction...");

    // Do the real tx if the static call succeeded
    const tx = await flashBorrower.FlashBorrow(
      pair,
      amount0Out,
      amount1Out,
      callbackData,
      { gasLimit: 500000 }
    );

    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
  } catch (error) {
    console.error("Execution failed:", error.reason || error.message);
  }
}

executeFlashLoan();