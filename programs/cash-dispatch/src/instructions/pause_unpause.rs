use anchor_lang::prelude::*;

use crate::{constants::DISTRIBUTION_TREE_SEED, error::DistributionError, state::DistributionTree};

#[derive(Accounts)]
#[instruction(params: PauseResumeParams)]
pub struct PauseResume<'info> {
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
        has_one = authority @ DistributionError::SignerNotAuthorized
    )]
    pub distribution_tree: Account<'info, DistributionTree>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PauseResumeParams {
    pub batch_id: String,
}

pub fn handle_pause(ctx: Context<PauseResume>, _params: PauseResumeParams) -> Result<()> {
    let distribution_tree = &mut ctx.accounts.distribution_tree;
    distribution_tree.pause()?;
    msg!("Paused Distribution Tree");
    Ok(())
}

pub fn handle_resume(ctx: Context<PauseResume>, _params: PauseResumeParams) -> Result<()> {
    let distribution_tree = &mut ctx.accounts.distribution_tree;
    distribution_tree.resume()?;
    msg!("Resumed Distribution Tree");
    Ok(())
}
