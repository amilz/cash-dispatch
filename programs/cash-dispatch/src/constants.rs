use anchor_lang::prelude::*;

#[constant]
pub const DISTRIBUTION_TREE_SEED: &'static [u8] = b"DISTRIBUTION_TREE";

#[constant]
pub const CURRENT_VERSION: u64 = 1;

#[cfg(feature = "mainnet")]
#[constant]
pub const PYUSD_MINT: &'static str = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";

#[cfg(feature = "devnet")]
#[constant]
pub const PYUSD_MINT: &'static str = "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM";

// Default to localnet for testing
#[cfg(any(feature = "localnet", not(any(feature = "mainnet", feature = "devnet"))))]
#[constant]
pub const PYUSD_MINT: &'static str = "PyuSdRak7SLogVeLcj8tgAk1JCJvHpfZ9R5keq25BkS";

#[constant]
pub const FEES_WALLET: &'static str = "FEESqUnJ5LEZgNpChDAbq2bDf5na3HTECAZhLUBMof3z";

pub const MAX_FEE_AMOUNT: u64 = 5_000_000_000; // $5,000

pub const BATCH_ID_MINIMUM_LENGTH: usize = 8;

pub const BATCH_ID_MAXIMUM_LENGTH: usize = 15;

pub const BITMAP_ARRAY_STEP: usize = 1000;