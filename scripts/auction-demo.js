const { ethers, network } = require("hardhat");

async function fastForwardFiveMinutes() {
  await network.provider.send("evm_increaseTime", [5 * 60]);
  await network.provider.send("evm_mine");
}

async function send(txPromise) {
  const tx = await txPromise;
  return tx.wait();
}

async function main() {
  const [seller, alice, bob, carol] = await ethers.getSigners();

  const Auction = await ethers.getContractFactory("Auction");
  const MockNFT = await ethers.getContractFactory("MockNFT");
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const auction = await Auction.deploy();
  const nft = await MockNFT.deploy();
  const token = await MockERC20.deploy();

  await auction.waitForDeployment();
  await nft.waitForDeployment();
  await token.waitForDeployment();

  const auctionAddress = await auction.getAddress();
  const nftAddress = await nft.getAddress();
  const tokenAddress = await token.getAddress();

  console.log("Auction:", auctionAddress);
  console.log("NFT:", nftAddress);
  console.log("ERC20:", tokenAddress);

  await send(nft.connect(seller).mint(seller.address));
  await send(nft.connect(seller).approve(auctionAddress, 1));

  await send(
    auction.connect(seller).listItem(nftAddress, 1, ethers.ZeroAddress)
  );
  console.log("\nETH auction listed for NFT #1");

  await send(
    auction.connect(alice).bidWithETH(0, {
      value: ethers.parseEther("1"),
    })
  );
  console.log("Alice bid 1 ETH");

  await send(
    auction.connect(bob).bidWithETH(0, {
      value: ethers.parseEther("1.5"),
    })
  );
  console.log("Bob bid 1.5 ETH and became highest bidder");

  const aliceRefund = await auction.ethRefunds(alice.address);
  console.log("Alice refundable ETH:", ethers.formatEther(aliceRefund));

  await fastForwardFiveMinutes();
  await send(auction.endAuction(0));
  console.log("ETH auction ended");
  console.log("NFT #1 owner:", await nft.ownerOf(1));
  console.log("Expected winner:", bob.address);

  await send(nft.connect(seller).mint(seller.address));
  await send(nft.connect(seller).approve(auctionAddress, 2));

  await send(token.mint(alice.address, ethers.parseEther("100")));
  await send(token.mint(carol.address, ethers.parseEther("100")));

  await send(auction.connect(seller).listItem(nftAddress, 2, tokenAddress));
  console.log("\nERC20 auction listed for NFT #2");

  await send(
    token.connect(alice).approve(auctionAddress, ethers.parseEther("25"))
  );
  await send(auction.connect(alice).bidWithToken(1, ethers.parseEther("25")));
  console.log("Alice bid 25 ADT");

  await send(
    token.connect(carol).approve(auctionAddress, ethers.parseEther("40"))
  );
  await send(auction.connect(carol).bidWithToken(1, ethers.parseEther("40")));
  console.log("Carol bid 40 ADT and became highest bidder");

  const aliceTokenRefund = await auction.tokenRefunds(
    tokenAddress,
    alice.address
  );
  console.log("Alice refundable ADT:", ethers.formatEther(aliceTokenRefund));

  await fastForwardFiveMinutes();
  await send(auction.endAuction(1));
  console.log("ERC20 auction ended");
  console.log("NFT #2 owner:", await nft.ownerOf(2));
  console.log("Expected winner:", carol.address);
  console.log(
    "Seller ADT balance:",
    ethers.formatEther(await token.balanceOf(seller.address))
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
