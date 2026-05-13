const { ethers } = require("hardhat");

async function main() {
  // Get test wallets from Hardhat
  const [seller, bidder1, bidder2] = await ethers.getSigners();

  console.log("Seller:", seller.address);
  console.log("Bidder1:", bidder1.address);
  console.log("Bidder2:", bidder2.address);

  // Get Auction contract
  const Auction = await ethers.getContractFactory("Auction");

  // Deploy contract
  const auction = await Auction.deploy();

  await auction.waitForDeployment();

  console.log("Auction deployed to:", await auction.getAddress());

  // =====================================================
  // SELLER CREATES AUCTION
  // =====================================================

  console.log("\nCreating auction item...");

  await auction
    .connect(seller)
    .listItem("MacBook Pro M3", ethers.ZeroAddress);

  console.log("Auction item created");

  // =====================================================
  // BIDDER 1 PLACES BID
  // =====================================================

  console.log("\nBidder1 placing 1 ETH bid...");

  await auction.connect(bidder1).bidETH(0, {
    value: ethers.parseEther("1"),
  });

  console.log("Bidder1 is highest bidder");

  // =====================================================
  // BIDDER 2 PLACES HIGHER BID
  // =====================================================

  console.log("\nBidder2 placing 2 ETH bid...");

  await auction.connect(bidder2).bidETH(0, {
    value: ethers.parseEther("2"),
  });

  console.log("Bidder2 is now highest bidder");

  // =====================================================
  // GET AUCTION DETAILS
  // =====================================================

  const item = await auction.auctions(0);

  console.log("\n===== AUCTION DETAILS =====");

  console.log("Item:", item.itemName);

  console.log("Seller:", item.seller);

  console.log("Highest Bidder:", item.highestBidder);

  console.log(
    "Highest Bid:",
    ethers.formatEther(item.highestBid),
    "ETH"
  );

  // =====================================================
  // CHECK REFUND
  // =====================================================

  const refund = await auction.ethRefunds(bidder1.address);

  console.log(
    "\nBidder1 refund:",
    ethers.formatEther(refund),
    "ETH"
  );

  // =====================================================
  // WAIT 5 MINUTES
  // =====================================================

  console.log("\nWaiting for auction to end...");

  await network.provider.send("evm_increaseTime", [300]);

  await network.provider.send("evm_mine");

  console.log("Auction ended");

  // =====================================================
  // END AUCTION
  // =====================================================

  await auction.endAuction(0);

  console.log("\nAuction finalized");

  // =====================================================
  // BIDDER1 WITHDRAWS REFUND
  // =====================================================

  await auction.connect(bidder1).withdrawETH();

  console.log("Bidder1 withdrew refund");

  console.log("\nAutomation complete");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});