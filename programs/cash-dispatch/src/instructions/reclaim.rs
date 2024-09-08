use anchor_lang::prelude::*;
use crate::{
    constants::DISTRIBUTION_TREE_SEED,
    error::DistributionError,
    state::DistributionTree,
};

#[derive(Accounts)]
#[instruction(params: ReclaimParams)]
pub struct Reclaim<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            DISTRIBUTION_TREE_SEED.as_ref(),
            distribution_tree.authority.as_ref(),
            params.batch_id.as_bytes(),
        ],
        bump = distribution_tree.bump,
        has_one = authority @ DistributionError::SignerNotAuthorized,
        realloc = distribution_tree.calculate_minimum_account_size(),
        realloc::payer = authority,
        realloc::zero = false,
    )]
    pub distribution_tree: Account<'info, DistributionTree>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ReclaimParams {
    pub batch_id: String,
}

pub fn handler(ctx: Context<Reclaim>, _params: ReclaimParams) -> Result<()> {
    let distribution_tree = &mut ctx.accounts.distribution_tree;
    distribution_tree.clear_recipients_distributed_bitmap()?;
    Ok(())
}