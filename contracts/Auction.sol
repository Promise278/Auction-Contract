// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
contract Auction {
    uint256 public constant AUCTION_DURATION = 5 minutes;
    uint256 public auctionCount;
    struct AuctionItem {
        address seller;
        string itemName; // instead of NFT
        address paymentToken; // address(0) = ETH
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool ended;
    }

    mapping(uint256 => AuctionItem) public auctions;

    mapping(address => uint256) public ethRefunds;
    mapping(address => mapping(address => uint256)) public tokenRefunds;

    function listItem(string memory itemName, address paymentToken) external returns (uint256 id) {
        id = auctionCount++;

        auctions[id] = AuctionItem({
            seller: msg.sender,
            itemName: itemName,
            paymentToken: paymentToken,
            highestBid: 0,
            highestBidder: address(0),
            endTime: block.timestamp + AUCTION_DURATION,
            ended: false
        });
    }

    function bidETH(uint256 id) external payable {
        AuctionItem storage a = auctions[id];

        require(block.timestamp < a.endTime, "Auction ended");
        require(!a.ended, "Already ended");
        require(a.paymentToken == address(0), "Not ETH auction");
        require(msg.value > a.highestBid, "Bid too low");

        if (a.highestBidder != address(0)) {
            ethRefunds[a.highestBidder] += a.highestBid;
        }

        a.highestBid = msg.value;
        a.highestBidder = msg.sender;
    }

    function bidToken(uint256 id, uint256 amount) external {
        AuctionItem storage a = auctions[id];

        require(block.timestamp < a.endTime, "Auction ended");
        require(!a.ended, "Already ended");
        require(a.paymentToken != address(0), "Not token auction");
        require(amount > a.highestBid, "Bid too low");

        IERC20(a.paymentToken).transferFrom(msg.sender, address(this), amount);

        if (a.highestBidder != address(0)) {
            tokenRefunds[a.paymentToken][a.highestBidder] += a.highestBid;
        }

        a.highestBid = amount;
        a.highestBidder = msg.sender;
    }

    function endAuction(uint256 id) external {
        AuctionItem storage a = auctions[id];

        require(block.timestamp >= a.endTime, "Not ended");
        require(!a.ended, "Already closed");

        a.ended = true;

        if (a.highestBidder == address(0)) {
            return;
        }

        if (a.paymentToken == address(0)) {
            payable(a.seller).transfer(a.highestBid);
        } else {
            IERC20(a.paymentToken).transfer(a.seller, a.highestBid);
        }
    }

    function withdrawETH() external {
        uint256 amount = ethRefunds[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        ethRefunds[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    function withdrawToken(address token) external {
        uint256 amount = tokenRefunds[token][msg.sender];
        require(amount > 0, "Nothing to withdraw");

        tokenRefunds[token][msg.sender] = 0;
        IERC20(token).transfer(msg.sender, amount);
    }
}