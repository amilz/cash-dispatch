use crate::{
    constants::DISTRIBUTION_TREE_SEED, error::DistributionError, state::DistributionTree,
    utils::check_gateway_token, DistributionStatus, REQUIRE_CIVIC_PASS,
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
#[instruction(params: ClaimParams)]
pub struct Claim<'info> {
    /// Claimant of the distribution
    #[account(mut)]
    pub claimant: Signer<'info>,

    /// DistributionTree account
    #[account(
        mut,
        seeds = [
            DISTRIBUTION_TREE_SEED.as_ref(),
            params.batch_id.as_bytes(),
        ],
        bump = distribution_tree.bump,
        has_one = mint @ DistributionError::InvalidTokenMint,
        has_one = token_vault @ DistributionError::InvalidTokenVault,
    )]
    pub distribution_tree: Account<'info, DistributionTree>,

    /// Mint account (PYUSD)
    #[account(
        address = distribution_tree.mint,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// Token Vault account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = distribution_tree,
        associated_token::token_program = token_program
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// Claimant's token account
    #[account(
        init_if_needed,
        payer = claimant,
        associated_token::mint = mint,
        associated_token::authority = claimant,
        associated_token::token_program = token_program
    )]
    pub claimant_token_account: InterfaceAccount<'info, TokenAccount>,

    /// System & Token programs
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,

    /// Optional Civic Pass
    /// CHECK: Verified by the solana-gateway program
    pub gateway_token: Option<UncheckedAccount<'info>>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ClaimParams {
    pub amount: u64,
    pub proof: Vec<[u8; 32]>,
    pub batch_id: String,
    pub index: u64,
}

impl<'info> Claim<'info> {
    fn transfer_to_claimant(&self, amount: u64) -> Result<()> {
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
                    to: self.claimant_token_account.to_account_info(),
                    authority: self.distribution_tree.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
            self.mint.decimals,
        )
    }
}

/// Validates the distribution parameters
///     1. The distribution has started
///     2. The distribution has not ended
///     3. The distribution is active
///     4. The proof is valid
pub fn validate(ctx: &Context<Claim>, params: &ClaimParams) -> Result<()> {
    let distribution_tree = &ctx.accounts.distribution_tree;
    let current_ts = Clock::get()?.unix_timestamp;
    require_gte!(
        current_ts,
        distribution_tree.start_ts,
        DistributionError::DistributionNotStarted
    );
    require_gte!(
        distribution_tree.end_ts,
        current_ts,
        DistributionError::DistributionEnded
    );
    require!(
        distribution_tree.status == DistributionStatus::Active,
        DistributionError::DistributionNotActive
    );
    require!(
        !distribution_tree.is_claimed(params.index)?,
        DistributionError::AlreadyClaimed
    );
    require!(
        distribution_tree.allow_claims,
        DistributionError::ClaimsNotAllowed
    );

    distribution_tree.verify_proof(
        ctx.accounts.claimant.key(),
        params.amount,
        &params.proof,
        params.index,
    )?;

    let gateway_check_required =
        REQUIRE_CIVIC_PASS && ctx.accounts.distribution_tree.gatekeeper_network.is_some();

    if gateway_check_required {
        check_gateway_token(
            Some(
                &ctx.accounts
                    .gateway_token
                    .as_ref()
                    .unwrap()
                    .to_account_info(),
            ),
            &&ctx.accounts.claimant.to_account_info(),
            &ctx.accounts.distribution_tree.gatekeeper_network.unwrap(),
            None,
        )?;
    }

    Ok(())
}

/// Distributes the tokens to the claimant
///     1. Increments the total number distributed
///     2. Transfers the tokens to the claimant
pub fn handler(ctx: Context<Claim>, params: ClaimParams) -> Result<()> {
    let distribution_tree = &mut ctx.accounts.distribution_tree;

    distribution_tree.increment_number_distributed()?;

    distribution_tree.set_claimed(params.index)?;

    ctx.accounts.transfer_to_claimant(params.amount)?;
    Ok(())
}
