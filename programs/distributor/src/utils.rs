use anchor_lang::prelude::*;
use solana_gateway::{Gateway, VerificationOptions};
use crate::error::DistributionError;
use crate::constants::MAX_FEE_AMOUNT;

/// Source: https://github.com/saber-hq/merkle-distributor/blob/master/programs/merkle-distributor/src/merkle_proof.rs
/// These functions deal with verification of Merkle trees (hash trees).
/// Direct port of https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.0/contracts/cryptography/MerkleProof.sol

/// Returns true if a `leaf` can be proved to be a part of a Merkle tree
/// defined by `root`. For this, a `proof` must be provided, containing
/// sibling hashes on the branch from the leaf to the root of the tree. Each
/// pair of leaves and each pair of pre-images are assumed to be sorted.
pub fn verify(proof: &Vec<[u8; 32]>, root: [u8; 32], leaf: [u8; 32]) -> bool {
    let mut computed_hash = leaf;
    for proof_element in proof.into_iter() {
        if computed_hash <= *proof_element {
            // Hash(current computed hash + current element of the proof)
            computed_hash =
                anchor_lang::solana_program::keccak::hashv(&[&computed_hash, proof_element]).0;
            // Hash(current element of the proof + current computed hash)
        } else {
            computed_hash =
                anchor_lang::solana_program::keccak::hashv(&[proof_element, &computed_hash]).0;
        }
    }
    // Check if the computed hash (root) is equal to the provided root
    computed_hash == root
}

pub fn check_gateway_token(
    gateway_token: Option<&AccountInfo>,
    recipient: &AccountInfo,
    gatekeeper_network: &Pubkey,
    options: Option<VerificationOptions>,
) -> Result<()> {
    require!(
        gateway_token.is_some(),
        DistributionError::InvalidGatewayToken
    );
    Gateway::verify_gateway_token_account_info(
        gateway_token.unwrap(),
        &recipient.key(),
        &gatekeeper_network,
        options,
    )
    .map_err(|_| {
        msg!("Gateway token verification failed");
        DistributionError::InvalidGatewayToken
    })?;

    Ok(())
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum FeeTier {
    Free,
    Tier1,
    Tier2,
    Tier3,
    Tier4,
}

impl FeeTier {
    pub fn get_fee_bps(&self) -> u64 {
        match self {
            FeeTier::Free => 0,
            FeeTier::Tier1 => 10,
            FeeTier::Tier2 => 5,
            FeeTier::Tier3 => 2,
            FeeTier::Tier4 => 1,
        }
    }

    pub fn get_threshold(&self) -> u64 {
        match self {
            FeeTier::Free => 0,
            FeeTier::Tier1 => 10_000_000_000,   // $10,000
            FeeTier::Tier2 => 100_000_000_000,  // $100,000
            FeeTier::Tier3 => 1_000_000_000_000, // $1,000,000
            FeeTier::Tier4 => 10_000_000_000_000, // $10,000,000
        }
    }
}

pub fn calculate_fee(amount: u64) -> Result<u64> {
    let fee_tier = get_fee_tier(amount);
    let fee_bps = fee_tier.get_fee_bps();

    let fee_amount = amount
        .checked_mul(fee_bps)
        .ok_or(ProgramError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    Ok(fee_amount.min(MAX_FEE_AMOUNT))
}

fn get_fee_tier(amount: u64) -> FeeTier {
    [
        FeeTier::Tier4,
        FeeTier::Tier3,
        FeeTier::Tier2,
        FeeTier::Tier1,
    ]
    .into_iter()
    .find(|tier| amount >= tier.get_threshold())
    .unwrap_or(FeeTier::Free)
}
