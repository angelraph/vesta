// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestToken} from "./TestToken.sol";

/// Local unit tests only. Stands in for Agora's pair: takes the input and
/// pays out the same amount of the other token, scaled by decimals.
contract TestPair {
    uint256 public scale = 1e12;

    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256)
        external
        returns (uint256[] memory amounts)
    {
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        uint256 out = amountIn * scale;
        require(out >= amountOutMin, "slippage");
        TestToken(path[1]).mint(to, out);
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = out;
    }
}
