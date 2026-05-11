// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract Auction {
    uint256 public constant AUCTION_DURATION = 5 minutes;

    uint256 public auctionCount;
    bool private locked;

    struct AuctionItem {
        address seller;
        address nftAddress;
        uint256 tokenId;
        address paymentToken; // address(0) = ETH
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool ended;
    }

    mapping(uint256 => AuctionItem) public auctions;
    mapping(address => uint256) public ethRefunds;
    mapping(address => mapping(address => uint256)) public tokenRefunds;

    // ── Guards ──────────────────────────────────────────────────

    function _active(AuctionItem storage a) internal view {
        require(block.timestamp < a.endTime && !a.ended, "Auction not active");
    }

    function _lock() internal {
        require(!locked, "Reentrant call");
        locked = true;
    }

    // ── Core functions ──────────────────────────────────────────

    function listItem(
        address nft,
        uint256 tokenId,
        address token
    ) external returns (uint256 id) {
        id = auctionCount++;
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        auctions[id] = AuctionItem(
            msg.sender,
            nft,
            tokenId,
            token,
            0,
            address(0),
            block.timestamp + AUCTION_DURATION,
            false
        );
    }

    function bidWithETH(uint256 id) external payable {
        AuctionItem storage a = auctions[id];
        _active(a);
        require(a.paymentToken == address(0), "ETH not accepted");
        require(msg.value > a.highestBid, "Bid too low");

        if (a.highestBidder != address(0))
            ethRefunds[a.highestBidder] += a.highestBid;
        a.highestBid = msg.value;
        a.highestBidder = msg.sender;
    }

    function bidWithToken(uint256 id, uint256 amount) external {
        AuctionItem storage a = auctions[id];
        _active(a);
        require(a.paymentToken != address(0), "Only ETH accepted");
        require(amount > a.highestBid, "Bid too low");

        IERC20(a.paymentToken).transferFrom(msg.sender, address(this), amount);
        if (a.highestBidder != address(0))
            tokenRefunds[a.paymentToken][a.highestBidder] += a.highestBid;
        a.highestBid = amount;
        a.highestBidder = msg.sender;
    }

    function endAuction(uint256 id) external {
        AuctionItem storage a = auctions[id];
        require(block.timestamp >= a.endTime && !a.ended, "Cannot end yet");
        _lock();
        a.ended = true;

        if (a.highestBidder == address(0)) {
            // No bids — return NFT to seller
            IERC721(a.nftAddress).transferFrom(
                address(this),
                a.seller,
                a.tokenId
            );
        } else {
            // Transfer NFT to winner, pay seller
            IERC721(a.nftAddress).transferFrom(
                address(this),
                a.highestBidder,
                a.tokenId
            );
            if (a.paymentToken == address(0)) {
                payable(a.seller).transfer(a.highestBid);
            } else {
                IERC20(a.paymentToken).transfer(a.seller, a.highestBid);
            }
        }
        locked = false;
    }

    function withdrawETH() external {
        _lock();
        uint256 amt = ethRefunds[msg.sender];
        require(amt > 0, "Nothing to withdraw");
        ethRefunds[msg.sender] = 0;
        payable(msg.sender).transfer(amt);
        locked = false;
    }

    function withdrawToken(address token) external {
        _lock();
        uint256 amt = tokenRefunds[token][msg.sender];
        require(amt > 0, "Nothing to withdraw");
        tokenRefunds[token][msg.sender] = 0;
        IERC20(token).transfer(msg.sender, amt);
        locked = false;
    }
}