use crate::constants::DISTRIBUTION_TREE_SEED;
use crate::error::DistributionError;
use crate::state::{DistributionStatus, DistributionTree};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
#[instruction(params: CancelParams)]
pub struct Cancel<'info> {
    /// The authority of the DistributionTree
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The DistributionTree to be cancelled
    #[account(
        mut,
        has_one = authority @ DistributionError::SignerNotAuthorized,
        has_one = mint @ DistributionError::InvalidTokenMint,
        has_one = token_vault @ DistributionError::InvalidTokenVault,
        constraint = distribution_tree.status == DistributionStatus::Active @ DistributionError::DistributionNotActive,
        seeds = [DISTRIBUTION_TREE_SEED.as_ref(), params.batch_id.as_bytes()],
        bump = distribution_tree.bump
    )]
    pub distribution_tree: Account<'info, DistributionTree>,

    /// Mint account
    #[account(address = distribution_tree.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    /// Token Vault account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = distribution_tree,
        associated_token::token_program = token_program
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// Authority's token account
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CancelParams {
    pub batch_id: String,
}

impl<'info> Cancel<'info> {
    fn transfer_to_authority(&self, amount: u64) -> Result<()> {
        let bump = &[self.distribution_tree.bump];
        let seeds: &[&[u8]] = &[
            DISTRIBUTION_TREE_SEED.as_ref(),
            self.distribution_tree.batch_id.as_bytes(),
            bump,
        ];
        let signer_seeds = &[&seeds[..]];

        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.token_vault.to_account_info(),
                    mint: self.mint.to_account_info(),
                    to: self.authority_token_account.to_account_info(),
                    authority: self.distribution_tree.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
            self.mint.decimals,
        )
    }
}

pub fn validate(ctx: &Context<Cancel>, _params: &CancelParams) -> Result<()> {
    let distribution_tree = &ctx.accounts.distribution_tree;
    require!(
        distribution_tree.status != DistributionStatus::Complete || distribution_tree.status != DistributionStatus::Cancelled,
        DistributionError::DistributionNotActive
    );
    Ok(())
}

pub fn handler(ctx: Context<Cancel>, _params: CancelParams) -> Result<()> {
    let refund_amount = ctx.accounts.token_vault.amount;
    ctx.accounts.transfer_to_authority(refund_amount)?;

    let distribution_tree: &mut Account<'_, DistributionTree> = &mut ctx.accounts.distribution_tree;
    distribution_tree.cancel();

    msg!(
        "Distribution cancelled for batch ID: {} after {} distributions.",
        distribution_tree.batch_id,
        distribution_tree.number_distributed
    );

    Ok(())
}
