// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title GasTap
/// @notice Holds MON and hands new Vesta accounts enough to pay network fees.
/// Monad reverts an account's MON transfer that dips it under its 10 MON
/// reserve while it has another transaction in flight, which broke back-to-back
/// top-ups from the sponsor wallet. Here the sponsor only calls; the MON leaves
/// this contract, so sponsoring keeps working under load.
contract GasTap {
    address public immutable owner;

    error NotOwner();
    error SendFailed();

    event Dripped(address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    function drip(address payable to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert SendFailed();
        emit Dripped(to, amount);
    }

    function withdraw(uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        (bool ok, ) = payable(owner).call{value: amount}("");
        if (!ok) revert SendFailed();
    }
}
