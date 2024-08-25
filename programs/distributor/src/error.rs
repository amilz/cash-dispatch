use anchor_lang::prelude::*;

#[error_code]
pub enum DistributionError {
    #[msg("Invalid Merkle proof")]
    InvalidProof,
    #[msg("Distribution is paused")]
    Paused,
    // Other custom errors...
}
