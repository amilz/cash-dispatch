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
    #[msg("Batch ID is too long")]
    BatchIdTooLong,
    #[msg("Batch ID is too short")]
    BatchIdTooShort,
    #[msg("Math error")]
    MathError,
    #[msg("Distribution has not started")]
    DistributionNotStarted,
    #[msg("Distribution has ended")]
    DistributionEnded,
    #[msg("Already distributed to all recipients")]
    DistributionAlreadyComplete,
    #[msg("Invalid Token Mint")]
    InvalidTokenMint,
    #[msg("Invalid Token Vault")]
    InvalidTokenVault,
    #[msg("Signer is Not Authorized for this DistributionTree")]
    SignerNotAuthorized,
    // Other custom errors...
}

