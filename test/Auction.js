const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Auction Contract", function () {
  let auction;
  let seller, bidder1, bidder2;

  beforeEach(async function () {
    [seller, bidder1, bidder2] = await ethers.getSigners();

    const Auction = await ethers.getContractFactory("Auction");
    auction = await Auction.deploy();
    await auction.waitForDeployment();
  });

  it("should list item for auction", async function () {
    const tx = await auction
      .connect(seller)
      .listItem("iPhone 15", ethers.ZeroAddress);

    await tx.wait();

    const item = await auction.auctions(0);

    expect(item.seller).to.equal(seller.address);
    expect(item.itemName).to.equal("iPhone 15");
  });

  it("should allow ETH bidding", async function () {
    await auction.connect(seller).listItem("Laptop", ethers.ZeroAddress);

    await auction.connect(bidder1).bidETH(0, {
      value: ethers.parseEther("1"),
    });

    const item = await auction.auctions(0);

    expect(item.highestBidder).to.equal(bidder1.address);
  });

  it("should reject lower bids", async function () {
    await auction.connect(seller).listItem("Phone", ethers.ZeroAddress);

    await auction.connect(bidder1).bidETH(0, {
      value: ethers.parseEther("1"),
    });

    await expect(
      auction.connect(bidder2).bidETH(0, {
        value: ethers.parseEther("0.5"),
      })
    ).to.be.revertedWith("Bid too low");
  });
});