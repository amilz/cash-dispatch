pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4cBCwB9oVf32w8wBsUH4FxGcfQfgPWKaSnJfLpFLVvvv");

#[program]
pub mod distributor {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, capacity: u32) -> Result<()> {
        instructions::initialize::handler(ctx, capacity)
    }

    /* TODO: Add remaining instructions

    pub fn add_recipient(ctx: Context<AddRecipient>, wallet: Pubkey, amount: u64) -> Result<()> {
        instructions::add_recipient::handler(ctx, wallet, amount)
    }

    pub fn distribute(ctx: Context<Distribute>, proof: Vec<[u8; 32]>) -> Result<()> {
        instructions::distribute::handler(ctx, proof)
    }

    pub fn verify_distribution_status(ctx: Context<VerifyStatus>, index: u32, proof: Vec<[u8; 32]>) -> Result<bool> {
        instructions::verify_distribution_status::handler(ctx, index, proof)
    }

    pub fn update_recipient_amount(ctx: Context<UpdateAmount>, index: u32, new_amount: u64, proof: Vec<[u8; 32]>) -> Result<()> {
        instructions::update_recipient_amount::handler(ctx, index, new_amount, proof)
    }

    pub fn remove_recipient(ctx: Context<RemoveRecipient>, index: u32, proof: Vec<[u8; 32]>) -> Result<()> {
        instructions::remove_recipient::handler(ctx, index, proof)
    }

    pub fn pause_distributions(ctx: Context<PauseDistributions>) -> Result<()> {
        instructions::pause_distributions::handler(ctx)
    }

    pub fn resume_distributions(ctx: Context<ResumeDistributions>) -> Result<()> {
        instructions::resume_distributions::handler(ctx)
    }

    pub fn get_distribution_state(ctx: Context<GetState>) -> Result<DistributionTreeState> {
        instructions::get_distribution_state::handler(ctx)
    }

     */
}
