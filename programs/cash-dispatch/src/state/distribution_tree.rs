use anchor_lang::{prelude::*, solana_program::keccak::hashv};

use crate::{error::DistributionError, utils::verify, BITMAP_ARRAY_STEP, CURRENT_VERSION, DISTRIBUTION_TREE_SEED};

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
    /// Bitmap for tracking which recipients have been distributed
    /// Each bit represents a recipient, where 1 means distributed and 0 means not distributed
    /// Initialize with 1,000  u64 elements (1000 * 64 = 64,000 bits/recipients)
    #[max_len(BITMAP_ARRAY_STEP)]
    pub recipients_distributed_bitmap: Vec<u64>,
    /// The status of the distribution
    pub status: DistributionStatus,
    /// Whether or not individual recipients can claim their tokens
    pub allow_claims: bool,
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
    /// (optional) Gateway Network
    pub gatekeeper_network: Option<Pubkey>,
}

impl DistributionTree {
    /// Calculates the account size of the Distribution Tree based on current state
    pub fn calculate_account_size(&self) -> usize {
        // Start with the size of all fixed fields
        let size = 8 // discriminator
            + 1 // bump
            + 8 // version
            + 32 // authority
            + 4 + 20 // batch_id (4 bytes for length + max 20 bytes for string)
            + 1 // status (enum)
            + 1 // allow_claims
            + 32 // merkle_root
            + 32 // mint
            + 32 // token_vault
            + 8 // total_number_recipients
            + 8 // number_distributed
            + 8 // start_ts
            + 8 // end_ts
            + 4 // recipients_distributed_bitmap length
            + self.recipients_distributed_bitmap.len() * 8 // each u64 is 8 bytes
            + 1 // Option for gatekeeper network
            + self.gatekeeper_network.map_or(0, |_| 32);
        size
    }

    /// Calculates the space required for resetting the recipients_distributed_bitmap
    pub fn calculate_minimum_account_size(&self) -> usize {
        self.calculate_account_size() - (self.recipients_distributed_bitmap.len() * 8)
    }

    /// Initializes the Distribution Tree
    pub fn initialize(
        &mut self,
        bump: u8,
        authority: Pubkey,
        batch_id: String,
        allow_claims: bool,
        merkle_root: [u8; 32],
        mint: Pubkey,
        token_vault: Pubkey,
        total_number_recipients: u64,
        start_ts: i64,
        end_ts: Option<i64>,
        gatekeeper_network: Option<Pubkey>,
    ) -> Result<()> {
        let end_ts = end_ts.unwrap_or(i64::MAX);
        self.bump = bump;
        self.version = CURRENT_VERSION;
        self.authority = authority;
        self.batch_id = batch_id;
        self.status = DistributionStatus::Active;
        self.allow_claims = allow_claims;
        self.merkle_root = merkle_root;
        self.mint = mint;
        self.token_vault = token_vault;
        self.total_number_recipients = total_number_recipients;
        self.number_distributed = 0;
        self.start_ts = start_ts;
        self.end_ts = end_ts;
        self.initialize_recipients_distributed_bitmap()?;
        self.gatekeeper_network = gatekeeper_network;
        Ok(())
    }

    /// Returns the seeds used to sign for this Distribution Tree PDA
    pub fn signer_seeds(&self) -> [&[u8]; 3] {
        [
            DISTRIBUTION_TREE_SEED.as_ref(),
            self.batch_id.as_ref(),
            std::slice::from_ref(&self.bump)
        ]
    }

    /// Calculates the required size of the recipients_distributed_bitmap vector
    fn calculate_required_vec_size(&self) -> usize {
        ((self.total_number_recipients + 63) / 64) as usize
    }

    /// Initializes the recipients_distributed_bitmap bitmap
    fn initialize_recipients_distributed_bitmap(&mut self) -> Result<()> {
        let vec_size = self.calculate_required_vec_size();

        if vec_size <= BITMAP_ARRAY_STEP {
            self.recipients_distributed_bitmap = vec![0u64; vec_size];
            self.status = DistributionStatus::Active;
        } else {
            self.recipients_distributed_bitmap = vec![0u64; BITMAP_ARRAY_STEP];
            self.status = DistributionStatus::InsufficientBitmapSpace;
            let additional_reallocs_required = (vec_size - BITMAP_ARRAY_STEP) / BITMAP_ARRAY_STEP;
            msg!(
                "Insufficient bitmap space. Reallocating {} times",
                additional_reallocs_required
            );
        }

        Ok(())
    }

    /// Calculates how much bigger to increase the recipients_distributed_bitmap vector
    pub fn calculate_expansion_required(&self) -> usize {
        let current_size = self.recipients_distributed_bitmap.len();
        let required_size = self.calculate_required_vec_size();
        let remaining_size = required_size.saturating_sub(current_size);
        remaining_size.min(BITMAP_ARRAY_STEP)
    }

    /// Expands the recipients_distributed_bitmap bitmap
    pub fn expand_recipients_distributed_bitmap(&mut self) -> Result<()> {
        require!(
            self.status == DistributionStatus::InsufficientBitmapSpace,
            DistributionError::InvalidDistributionStatus
        );
        let required_size = self.calculate_required_vec_size();
        let expansion_size = self.calculate_expansion_required();

        self.recipients_distributed_bitmap
            .extend(vec![0u64; expansion_size]);

        if self.recipients_distributed_bitmap.len() >= required_size {
            self.status = DistributionStatus::Active;
        } else {
            let additional_reallocs_required =
                (required_size - self.recipients_distributed_bitmap.len()) / BITMAP_ARRAY_STEP;
            msg!(
                "Insufficient bitmap space. Reallocating {} times",
                additional_reallocs_required
            );
        }

        Ok(())
    }

    /// For complete distributions, clears the recipients_distributed_bitmap
    /// This can be done safely because "Complete" distributions mean that all recipients have been distributed
    /// Meaning that we can verify the distribution details by checking the root of the Merkle tree
    pub fn clear_recipients_distributed_bitmap(&mut self) -> Result<()> {
        require!(
            self.status == DistributionStatus::Complete || self.status == DistributionStatus::Cancelled,
            DistributionError::DistributionNotComplete
        );
        self.recipients_distributed_bitmap = vec![0u64; 0];
        Ok(())
    }

    /// Increments the number of recipients distributed
    pub fn increment_number_distributed(&mut self) -> Result<()> {
        self.number_distributed = self
            .number_distributed
            .checked_add(1)
            .ok_or(DistributionError::MathError)?;

        require_gte!(
            self.total_number_recipients,
            self.number_distributed,
            DistributionError::DistributionAlreadyComplete
        );

        if self.is_complete() {
            self.status = DistributionStatus::Complete;
        }

        Ok(())
    }

    /// Checks if a recipient at the given index has been distributed to
    pub fn is_claimed(&self, index: u64) -> Result<bool> {
        let (bitmap_index, bit_index) = self.get_bitmap_indices(index)?;
        Ok((self.recipients_distributed_bitmap[bitmap_index] & (1u64 << bit_index)) != 0)
    }

    /// Marks a recipient at the given index as distributed
    pub fn set_claimed(&mut self, index: u64) -> Result<()> {
        let (bitmap_index, bit_index) = self.get_bitmap_indices(index)?;
        self.recipients_distributed_bitmap[bitmap_index] |= 1u64 << bit_index;
        Ok(())
    }

    fn index_in_bounds(&self, index: u64) -> Result<()> {
        require_gt!(
            self.total_number_recipients,
            index,
            DistributionError::IndexOutOfBounds
        );
        Ok(())
    }

    fn get_bitmap_indices(&self, index: u64) -> Result<(usize, u8)> {
        self.index_in_bounds(index)?;
        let bitmap_index = (index / 64) as usize;
        let bit_index = (index % 64) as u8;
        Ok((bitmap_index, bit_index))
    }

    /// Returns the total number of recipients who have been distributed to
    pub fn total_claimed(&self) -> u64 {
        self.recipients_distributed_bitmap
            .iter()
            .map(|&x| x.count_ones() as u64)
            .sum()
    }

    pub fn verify_proof(
        &self,
        recipient: Pubkey,
        amount: u64,
        proof: &Vec<[u8; 32]>,
        index: u64,
    ) -> Result<()> {
        let leaf = self.get_leaf(recipient, amount, index);
        let proof_is_valid = verify(proof, self.merkle_root, leaf);
        require!(proof_is_valid, DistributionError::InvalidProof);
        Ok(())
    }

    fn get_leaf(&self, recipient: Pubkey, amount: u64, index: u64) -> [u8; 32] {
        hashv(&[
            &index.to_le_bytes(),
            &recipient.to_bytes(),
            &amount.to_le_bytes(),
        ])
        .0
    }

    pub fn pause(&mut self) -> Result<()> {
        require!(
            self.status == DistributionStatus::Active,
            DistributionError::InvalidDistributionStatus
        );
        self.status = DistributionStatus::Paused;
        Ok(())
    }

    pub fn resume(&mut self) -> Result<()> {
        require!(
            self.status == DistributionStatus::Paused,
            DistributionError::InvalidDistributionStatus
        );
        self.status = DistributionStatus::Active;
        Ok(())
    }

    pub fn cancel(&mut self) {
        self.status = DistributionStatus::Cancelled;
    }

    fn is_complete(&self) -> bool {
        self.number_distributed == self.total_number_recipients
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum DistributionStatus {
    InsufficientBitmapSpace,
    Active,
    Complete,
    Paused,
    Cancelled,
}
