// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Agora's Instant Settlement pair (stable swap) on Monad.
interface IAgoraPair {
    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        returns (uint256[] memory amounts);
}

/// @notice Grants a contract the APPROVED_SWAPPER role on Agora pairs. Open on testnet.
interface IAgoraWhitelister {
    function setApprovedSwapper(address swapper) external;
}

/// @title HouseVault
/// @notice Shared money for people who live together: a rent pot, bill splits,
/// settlements between housemates and money sent home. Every balance is AUSD.
contract HouseVault {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_MEMBERS = 12;
    uint256 public constant MAX_BLOB = 4096;

    struct House {
        string name;
        address creator;
        address landlord;
        uint256 rent; // AUSD per cycle
        uint256 pot; // AUSD held for rent
        uint64 period; // seconds between rent days
        uint64 nextDue; // timestamp of the next rent day
        uint32 cycle; // increments every time rent is paid out
        bytes32 inviteHash; // keccak256 of the invite secret
    }

    IERC20 public immutable ausd;
    /// @notice Agora Instant Settlement pair that pays out money sent home. Zero means plain AUSD transfers.
    IAgoraPair public immutable settlement;
    /// @notice What the recipient receives from the pair (the local-currency side).
    address public immutable payout;
    address public owner;
    address public keeper; // rent-day automation (Chainlink CRE forwarder)

    uint256 public houseCount;
    mapping(uint256 => House) internal _houses;
    mapping(uint256 => address[]) internal _members;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(address => uint256[]) internal _housesOf;

    /// @notice Who is owed what inside a house. Positive means the house owes you.
    mapping(uint256 => mapping(address => int256)) public net;
    /// @notice Rent paid by a member in a given cycle.
    mapping(uint256 => mapping(uint32 => mapping(address => uint256))) public rentPaid;

    /// @notice Shared house notes, encrypted with the house key. Ciphertext only.
    mapping(uint256 => bytes) public houseNotes;
    /// @notice The house key, wrapped (encrypted) under each member's own passkey-derived key.
    mapping(uint256 => mapping(address => bytes)) public keyring;
    /// @notice The name housemates see. Plain text by design.
    mapping(address => string) public displayName;
    /// @notice Encrypted steward memory per person. Ciphertext only.
    mapping(address => bytes) public stewardMemory;

    uint256 public expenseCount;

    event HouseCreated(uint256 indexed houseId, address indexed creator, string name, address landlord, uint256 rent, uint64 period, uint64 firstDue);
    event MemberJoined(uint256 indexed houseId, address indexed member);
    event RentPaid(uint256 indexed houseId, address indexed member, address indexed payer, uint32 cycle, uint256 amount);
    event RentCollected(uint256 indexed houseId, uint32 cycle, address landlord, uint256 amount, uint64 nextDue);
    event RentShortfall(uint256 indexed houseId, address indexed member, uint32 cycle, uint256 shortBy);
    event ExpenseAdded(uint256 indexed houseId, uint256 indexed expenseId, address indexed payer, uint256 amount, string memo, address[] participants, uint256[] shares);
    event Settled(uint256 indexed houseId, address indexed from, address indexed to, uint256 amount);
    event SentHome(address indexed from, address indexed to, uint256 amount, bytes3 corridor, uint256 fxRate, string memo);
    event SettledHome(address indexed to, address token, uint256 amountOut);
    event NotesUpdated(uint256 indexed houseId, address indexed member);
    event KeyWrapped(uint256 indexed houseId, address indexed member);
    event NameSet(address indexed member, string name);
    event MemoryUpdated(address indexed member);
    event KeeperChanged(address keeper);

    error NotOwner();
    error NotKeeper();
    error NotMember();
    error AlreadyMember();
    error HouseFull();
    error BadInvite();
    error BadAmount();
    error BadSplit();
    error NotDue();
    error PotTooLow();
    error TooLarge();

    modifier onlyMember(uint256 houseId) {
        if (!isMember[houseId][msg.sender]) revert NotMember();
        _;
    }

    constructor(IERC20 _ausd, address _keeper, IAgoraPair _settlement, address _payout, IAgoraWhitelister _whitelister) {
        ausd = _ausd;
        settlement = _settlement;
        payout = _payout;
        if (address(_whitelister) != address(0)) _whitelister.setApprovedSwapper(address(this));
        owner = msg.sender;
        keeper = _keeper;
        emit KeeperChanged(_keeper);
    }

    // ---------------------------------------------------------------- houses

    function createHouse(
        string calldata name,
        address landlord,
        uint256 rent,
        uint64 period,
        uint64 firstDue,
        bytes32 inviteHash,
        bytes calldata wrappedKey
    ) external returns (uint256 houseId) {
        if (period == 0 || bytes(name).length == 0 || bytes(name).length > 64) revert BadAmount();
        houseId = ++houseCount;
        House storage h = _houses[houseId];
        h.name = name;
        h.creator = msg.sender;
        h.landlord = landlord;
        h.rent = rent;
        h.period = period;
        h.nextDue = firstDue;
        h.inviteHash = inviteHash;
        emit HouseCreated(houseId, msg.sender, name, landlord, rent, period, firstDue);
        _addMember(houseId, msg.sender, wrappedKey);
    }

    function join(uint256 houseId, bytes32 inviteSecret, bytes calldata wrappedKey) external {
        House storage h = _houses[houseId];
        if (h.creator == address(0) || keccak256(abi.encodePacked(inviteSecret)) != h.inviteHash) revert BadInvite();
        _addMember(houseId, msg.sender, wrappedKey);
    }

    function _addMember(uint256 houseId, address who, bytes calldata wrappedKey) internal {
        if (wrappedKey.length > 256) revert TooLarge();
        if (isMember[houseId][who]) revert AlreadyMember();
        if (_members[houseId].length >= MAX_MEMBERS) revert HouseFull();
        isMember[houseId][who] = true;
        _members[houseId].push(who);
        _housesOf[who].push(houseId);
        emit MemberJoined(houseId, who);
        if (wrappedKey.length != 0) {
            keyring[houseId][who] = wrappedKey;
            emit KeyWrapped(houseId, who);
        }
    }

    // ------------------------------------------------------------------ rent

    /// @notice Put money into the rent pot for yourself.
    function payRent(uint256 houseId, uint256 amount) external onlyMember(houseId) {
        _payRent(houseId, msg.sender, amount);
    }

    /// @notice Put money into the rent pot on behalf of a member. Used by
    /// cross-chain deposits that execute on arrival, or a friend covering you.
    function payRentFor(uint256 houseId, address member, uint256 amount) external {
        if (!isMember[houseId][member]) revert NotMember();
        _payRent(houseId, member, amount);
    }

    function _payRent(uint256 houseId, address member, uint256 amount) internal {
        if (amount == 0) revert BadAmount();
        House storage h = _houses[houseId];
        ausd.safeTransferFrom(msg.sender, address(this), amount);
        h.pot += amount;
        rentPaid[houseId][h.cycle][member] += amount;
        emit RentPaid(houseId, member, msg.sender, h.cycle, amount);
    }

    /// @notice Pay the landlord once rent day has come and the pot is full.
    /// Anyone can call it; the rules are the same for everyone.
    function collectRent(uint256 houseId) public {
        House storage h = _houses[houseId];
        if (h.creator == address(0)) revert BadInvite();
        if (block.timestamp < h.nextDue) revert NotDue();
        if (h.pot < h.rent) revert PotTooLow();
        uint256 amount = h.rent;
        uint32 paidCycle = h.cycle;
        h.pot -= amount;
        h.cycle = paidCycle + 1;
        h.nextDue += h.period;
        ausd.safeTransfer(h.landlord, amount);
        emit RentCollected(houseId, paidCycle, h.landlord, amount, h.nextDue);
    }

    /// @notice Record who is short this cycle. Called by the rent-day workflow.
    function flagShortfall(uint256 houseId, address member, uint256 shortBy) public {
        if (msg.sender != keeper) revert NotKeeper();
        if (!isMember[houseId][member]) revert NotMember();
        emit RentShortfall(houseId, member, _houses[houseId].cycle, shortBy);
    }

    /// @notice Chainlink CRE report entrypoint. The forwarder delivers a
    /// signed report: (uint8 action, uint256 houseId, address member, uint256 amount).
    /// action 1 = collect rent, action 2 = flag shortfall.
    function onReport(bytes calldata, bytes calldata report) external {
        if (msg.sender != keeper) revert NotKeeper();
        (uint8 action, uint256 houseId, address member, uint256 amount) =
            abi.decode(report, (uint8, uint256, address, uint256));
        if (action == 1) {
            collectRent(houseId);
        } else if (action == 2) {
            if (!isMember[houseId][member]) revert NotMember();
            emit RentShortfall(houseId, member, _houses[houseId].cycle, amount);
        } else {
            revert BadAmount();
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        // IReceiver (onReport) and ERC165
        return interfaceId == 0x805f2132 || interfaceId == 0x01ffc9a7;
    }

    // ---------------------------------------------------------------- splits

    /// @notice Record a bill one member paid for the group. Shares must add up
    /// to the amount. Nothing moves yet; it only changes who owes whom.
    function addExpense(
        uint256 houseId,
        uint256 amount,
        string calldata memo,
        address[] calldata participants,
        uint256[] calldata shares
    ) external onlyMember(houseId) returns (uint256 expenseId) {
        if (amount == 0 || participants.length == 0 || participants.length != shares.length) revert BadSplit();
        if (bytes(memo).length > 80) revert TooLarge();
        uint256 total;
        for (uint256 i; i < participants.length; ++i) {
            if (!isMember[houseId][participants[i]]) revert NotMember();
            total += shares[i];
            net[houseId][participants[i]] -= int256(shares[i]);
        }
        if (total != amount) revert BadSplit();
        net[houseId][msg.sender] += int256(amount);
        expenseId = ++expenseCount;
        emit ExpenseAdded(houseId, expenseId, msg.sender, amount, memo, participants, shares);
    }

    /// @notice Pay a housemate back. AUSD moves straight to them.
    function settle(uint256 houseId, address to, uint256 amount) external onlyMember(houseId) {
        if (amount == 0 || to == msg.sender) revert BadAmount();
        if (!isMember[houseId][to]) revert NotMember();
        net[houseId][msg.sender] += int256(amount);
        net[houseId][to] -= int256(amount);
        ausd.safeTransferFrom(msg.sender, to, amount);
        emit Settled(houseId, msg.sender, to, amount);
    }

    // ------------------------------------------------------------ send home

    /// @notice Send AUSD to anyone, anywhere. It settles instantly through Agora's
    /// pair, so the recipient is paid out in the local-currency token in the same
    /// transaction. `corridor` is the destination currency (e.g. "NGN") and
    /// `fxRate` the rate shown to the sender, 1e6 scaled.
    function sendHome(address to, uint256 amount, uint256 minOut, bytes3 corridor, uint256 fxRate, string calldata memo) external {
        if (amount == 0 || to == address(0)) revert BadAmount();
        if (bytes(memo).length > 80) revert TooLarge();
        if (address(settlement) == address(0)) {
            ausd.safeTransferFrom(msg.sender, to, amount);
        } else {
            ausd.safeTransferFrom(msg.sender, address(this), amount);
            ausd.forceApprove(address(settlement), amount);
            address[] memory path = new address[](2);
            path[0] = address(ausd);
            path[1] = payout;
            uint256[] memory out = settlement.swapExactTokensForTokens(amount, minOut, path, to, block.timestamp);
            emit SettledHome(to, payout, out[1]);
        }
        emit SentHome(msg.sender, to, amount, corridor, fxRate, memo);
    }

    // -------------------------------------------------------- encrypted data

    function setHouseNotes(uint256 houseId, bytes calldata ciphertext) external onlyMember(houseId) {
        if (ciphertext.length > MAX_BLOB) revert TooLarge();
        houseNotes[houseId] = ciphertext;
        emit NotesUpdated(houseId, msg.sender);
    }

    function setWrappedKey(uint256 houseId, bytes calldata wrapped) external onlyMember(houseId) {
        if (wrapped.length > 256) revert TooLarge();
        keyring[houseId][msg.sender] = wrapped;
        emit KeyWrapped(houseId, msg.sender);
    }

    function setName(string calldata name) external {
        if (bytes(name).length == 0 || bytes(name).length > 32) revert TooLarge();
        displayName[msg.sender] = name;
        emit NameSet(msg.sender, name);
    }

    function setStewardMemory(bytes calldata ciphertext) external {
        if (ciphertext.length > MAX_BLOB) revert TooLarge();
        stewardMemory[msg.sender] = ciphertext;
        emit MemoryUpdated(msg.sender);
    }

    // ----------------------------------------------------------------- admin

    function setKeeper(address _keeper) external {
        if (msg.sender != owner) revert NotOwner();
        keeper = _keeper;
        emit KeeperChanged(_keeper);
    }

    // ----------------------------------------------------------------- views

    function getHouse(uint256 houseId) external view returns (House memory) {
        return _houses[houseId];
    }

    function membersOf(uint256 houseId) external view returns (address[] memory) {
        return _members[houseId];
    }

    function housesOf(address who) external view returns (uint256[] memory) {
        return _housesOf[who];
    }

    /// @notice How much each member still owes for the current rent cycle,
    /// assuming an equal split.
    function rentStatus(uint256 houseId)
        external
        view
        returns (address[] memory members, uint256[] memory paid, uint256 sharePerMember)
    {
        House storage h = _houses[houseId];
        members = _members[houseId];
        paid = new uint256[](members.length);
        sharePerMember = members.length == 0 ? 0 : h.rent / members.length;
        for (uint256 i; i < members.length; ++i) {
            paid[i] = rentPaid[houseId][h.cycle][members[i]];
        }
    }
}
