use anchor_lang::prelude::*;

#[error_code]
pub enum DistributionError {
    #[msg("Timestamps not in future")]
    TimestampsNotInFuture,
    #[msg("Start timestamp after end timestamp")]
    StartTimestampAfterEnd,
    #[msg("No recipients")]
    NoRecipients,
    #[msg("Zero transfer amount")]
    ZeroTransferAmount,
    #[msg("Invalid Merkle proof")]
    InvalidProof,
    #[msg("Distribution is paused")]
    Paused,
    // Other custom errors...
}

