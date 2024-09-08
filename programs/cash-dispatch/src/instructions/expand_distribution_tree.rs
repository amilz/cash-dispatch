use anchor_lang::prelude::*;
use crate::{constants::DISTRIBUTION_TREE_SEED, error::DistributionError, state::DistributionTree, DistributionStatus};

#[derive(Accounts)]
#[instruction(params: ExpandParams)]
pub struct ExpandDistributionTree<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [DISTRIBUTION_TREE_SEED.as_ref(), params.batch_id.as_bytes()],
        bump = distribution_tree.bump,
        has_one = authority @ DistributionError::SignerNotAuthorized,
        // Add space for more u64's based on BITMAP_ARRAY_STEP 
        realloc = distribution_tree.calculate_account_size() + (distribution_tree.calculate_expansion_required() * 8), 
        realloc::payer = authority,
        realloc::zero = false,
    )]
    pub distribution_tree: Account<'info, DistributionTree>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ExpandParams {
    pub batch_id: String,
}


pub fn validate(ctx: &Context<ExpandDistributionTree>) -> Result<()> {
    let distribution_tree = &ctx.accounts.distribution_tree;
    require!(
        distribution_tree.status == DistributionStatus::InsufficientBitmapSpace,
        DistributionError::InvalidDistributionStatus
    );

    Ok(())
}


/// Expands the recipients_distributed_bitmap bitmap
///     1. Verifies that the status is InsufficientBitmapSpace
///     2. Expands the recipients_distributed_bitmap bitmap
///     3. Sets the status to Active if the bitmap was expanded sufficiently
pub fn handler(ctx: Context<ExpandDistributionTree>, _params: ExpandParams) -> Result<()> {
    let distribution_tree = &mut ctx.accounts.distribution_tree;

    require_keys_eq!(
        distribution_tree.authority,
        ctx.accounts.authority.key(),
        DistributionError::SignerNotAuthorized
    );

    distribution_tree.expand_recipients_distributed_bitmap()?;

    Ok(())
}
