use anchor_lang::prelude::*;

use crate::CURRENT_VERSION;

#[account]
#[derive(InitSpace)]
pub struct DistributionTree {
    /// Bump seed.
    pub bump: u8,
    /// Version of the airdrop
    pub version: u64,
    /// Admin wallet
    pub authority: Pubkey,
    /// A client-generated unique identifier for the batch of recipients
    /// Recommended Use: YYYY-MM-DD-WXYZ where WXYZ is a random string of 4 alphanumeric characters (e.g. 2022-01-01-a1b2)
    /// However, any <= 15 characters can be used
    #[max_len(20)]
    pub batch_id: String,
    /// The 256-bit merkle root.
    pub merkle_root: [u8; 32],
    /// The token to be distributed.
    pub mint: Pubkey,
    /// Program ATA of the token to be distributed.
    pub token_vault: Pubkey,
    /// The number of unique recipients.
    pub total_number_recipients: u64,
    /// Number recipients claimed
    pub number_distributed: u64,
    /// Time when distribution can start (Unix Timestamp)
    pub start_ts: i64,
    /// Time when distribution is locked (Unix Timestamp)
    pub end_ts: i64,
}

impl DistributionTree {
    pub fn initialize(
        &mut self,
        bump: u8,
        authority: Pubkey,
        batch_id: String,
        merkle_root: [u8; 32],
        mint: Pubkey,
        token_vault: Pubkey,
        total_number_recipients: u64,
        start_ts: i64,
        end_ts: Option<i64>,
    ) -> Result<()> {
        let end_ts = end_ts.unwrap_or(i64::MAX);
        self.bump = bump;
        self.version = CURRENT_VERSION;
        self.authority = authority;
        self.batch_id = batch_id;
        self.merkle_root = merkle_root;
        self.mint = mint;
        self.token_vault = token_vault;
        self.total_number_recipients = total_number_recipients;
        self.number_distributed = 0;
        self.start_ts = start_ts;
        self.end_ts = end_ts;
        Ok(())
    }
}
