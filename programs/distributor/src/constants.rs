use anchor_lang::prelude::*;

#[constant]
pub const DISTRIBUTION_TREE: &'static [u8] = b"DISTRIBUTION_TREE";

#[constant]
pub const CURRENT_VERSION: u64 = 1;

#[cfg(feature = "localnet")]
#[constant]
pub const PYUSD_MINT: &'static str = "PyuSdRak7SLogVeLcj8tgAk1JCJvHpfZ9R5keq25BkS";

#[cfg(feature = "mainnet")]
#[constant]
pub const PYUSD_MINT: &'static str = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";

#[cfg(feature = "devnet")]
#[constant]
pub const PYUSD_MINT: &'static str = "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM";

// Default to localnet for testing
#[cfg(not(any(feature = "localnet", feature = "mainnet", feature = "devnet")))]
#[constant]
pub const PYUSD_MINT: &'static str = "PyuSdRak7SLogVeLcj8tgAk1JCJvHpfZ9R5keq25BkS";