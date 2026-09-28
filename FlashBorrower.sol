// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

error InvalidCaller();
error InvalidSender();
error RouterSwapFailed();
error RepayFailed();

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract FlashBorrower is IUniswapV2Callee, Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    function FlashBorrow(
        address pair,
        uint256 amount0Out,
        uint256 amount1Out,
        bytes calldata data
    ) external onlyOwner {
        assembly {
            tstore(0, pair)
        }

        IUniswapV2Pair(pair).swap(amount0Out, amount1Out, address(this), data);
    }

    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override {
        address storedActivePair;
        assembly {
            storedActivePair := tload(0)
        }
        if (msg.sender != storedActivePair) revert InvalidCaller();
        if (sender != address(this)) revert InvalidSender();
        uint256 borrowedAmount = amount0 > 0 ? amount0 : amount1;

        (   address targetRouter,   bytes memory routerData,
            address borrowedToken,  address repaymentToken,
            address minProfitToken, uint256 minProfitAmount,
            uint256 repaymentAmount
        ) = abi.decode(data, (address, bytes, address, address, address, uint256, uint256));

        IERC20(borrowedToken).approve(targetRouter, borrowedAmount);
        (bool success, ) = targetRouter.call(routerData);
        if (!success) revert RouterSwapFailed();

        bool repaid = IERC20(repaymentToken).transfer(storedActivePair, repaymentAmount);
        if (!repaid) revert RepayFailed();
    }

    function getReserves(address[] calldata pools) external view onlyOwner returns (uint256[] memory reserves) {        
        reserves = new uint256[](6);

        (uint112 r0A, uint112 r1A, ) = IUniswapV2Pair(pools[0]).getReserves();  reserves[0] = r0A;  reserves[1] = r1A;
        (uint112 r0B, uint112 r1B, ) = IUniswapV2Pair(pools[1]).getReserves();  reserves[2] = r0B;  reserves[3] = r1B;
        (uint112 r0C, uint112 r1C, ) = IUniswapV2Pair(pools[2]).getReserves();  reserves[4] = r0C;  reserves[5] = r1C;
    }

    error InsufficientBalance();
    error TransferFailed();

    function withdrawToken(address token, uint256 amount) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        if (withdrawAmount > balance) revert InsufficientBalance();
        if (!IERC20(token).transfer(owner(), withdrawAmount)) revert TransferFailed();
    }
}