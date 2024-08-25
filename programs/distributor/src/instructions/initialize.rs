use crate::{state::DistributionTree, Seeds};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + DistributionTree::INIT_SPACE,
        seeds = [
            Seeds::DISTRIBUTION_TREE.as_ref(),
            // TODO: Add unique identifier for the tree
        ],
        bump
    )]
    pub distribution_tree: Account<'info, DistributionTree>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, capacity: u32) -> Result<()> {
    let distribution_tree = &mut ctx.accounts.distribution_tree;
    let authority = &ctx.accounts.authority.key();
    let bump = ctx.bumps.distribution_tree;

    distribution_tree.initialize(capacity, *authority, bump)?;

    msg!("Distribution tree initialized with capacity: {}", capacity);

    Ok(())
}
