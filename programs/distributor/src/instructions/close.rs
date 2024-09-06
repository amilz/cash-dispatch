use crate::{constants::DISTRIBUTION_TREE_SEED, error::DistributionError, state::DistributionTree, DistributionStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(params: CloseParams)]
pub struct Close<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        close = authority,
        seeds = [
            DISTRIBUTION_TREE_SEED.as_ref(),
            params.batch_id.as_bytes(),
        ],
        bump = distribution_tree.bump,
        has_one = authority @ DistributionError::SignerNotAuthorized,
    )]
    pub distribution_tree: Account<'info, DistributionTree>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CloseParams {
    pub batch_id: String,
    pub acknowledge_irreversible: bool,
}

pub fn validate(ctx: &Context<Close>, params: &CloseParams) -> Result<()> {
    require!(
        params.acknowledge_irreversible,
        DistributionError::MustAcknowledgeIrreversible
    );

    require!(
        ctx.accounts.distribution_tree.status == DistributionStatus::Complete || ctx.accounts.distribution_tree.status == DistributionStatus::Cancelled,
        DistributionError::InvalidDistributionStatus
    );

    Ok(())
}

pub fn handler(_ctx: Context<Close>, _params: CloseParams) -> Result<()> {
    Ok(())
}
