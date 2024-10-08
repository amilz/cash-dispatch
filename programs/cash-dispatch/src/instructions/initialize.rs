use std::str::FromStr;

use crate::{
    constants::PYUSD_MINT, error::DistributionError, state::DistributionTree, utils::calculate_fee,
    BATCH_ID_MAXIMUM_LENGTH, BATCH_ID_MINIMUM_LENGTH, DISTRIBUTION_TREE_SEED, FEES_WALLET,
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    /// Signer and Authority of the DistributionTree
    #[account(mut)]
    pub authority: Signer<'info>,

    /// DistributionTree account
    #[account(
        init,
        payer = authority,
        space = 8 + DistributionTree::INIT_SPACE,
        seeds = [
            DISTRIBUTION_TREE_SEED.as_ref(),
            authority.key().as_ref(),
            params.batch_id.as_bytes(),
        ],
        bump
    )]
    pub distribution_tree: Account<'info, DistributionTree>,

    /// Mint account (PYUSD)
    #[account(
        address = Pubkey::from_str(&PYUSD_MINT).unwrap() @ DistributionError::InvalidTokenMint,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// Token Source account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority =authority,
        associated_token::token_program = token_program
    )]
    pub token_source: InterfaceAccount<'info, TokenAccount>,

    /// Token Vault account
    #[account(
        init,
        associated_token::mint = mint,
        associated_token::authority = distribution_tree,
        associated_token::token_program = token_program,
        payer = authority,
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,

    /// Fees Wallet Token Account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = Pubkey::from_str(&FEES_WALLET).unwrap(),
        associated_token::token_program = token_program
    )]
    pub fees_token_account: InterfaceAccount<'info, TokenAccount>,

    /// System & Token programs
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub merkle_root: [u8; 32],
    pub batch_id: String,
    pub allow_claims: bool,
    pub total_number_recipients: u64,
    pub transfer_to_vault_amount: u64,
    pub mint_decimals: u8,
    pub start_ts: i64,
    pub end_ts: Option<i64>,
    pub gatekeeper_network: Option<Pubkey>,
}

impl<'info> Initialize<'info> {
    fn transfer_to_vault(&self, amount: u64, decimals: u8) -> Result<()> {
        transfer_checked(
            CpiContext::new(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.token_source.to_account_info(),
                    mint: self.mint.to_account_info(),
                    to: self.token_vault.to_account_info(),
                    authority: self.authority.to_account_info(),
                },
            ),
            amount,
            decimals,
        )
    }

    fn pay_fees(&self, amount: u64, decimals: u8) -> Result<()> {
        transfer_checked(
            CpiContext::new(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.token_source.to_account_info(),
                    mint: self.mint.to_account_info(),
                    to: self.fees_token_account.to_account_info(),
                    authority: self.authority.to_account_info(),
                },
            ),
            amount,
            decimals,
        )
    }
}

/// Validates the initialization parameters
///     1. The start timestamp is before the end timestamp
///     2. The end timestamps is in the future
///     3. The total number of recipients is greater than 0
///     4. The transfer amount is greater than 0
///     5. The batch_id is between 8 and 15 characters
pub fn validate(_ctx: &Context<Initialize>, params: &InitializeParams) -> Result<()> {
    let current_ts = Clock::get()?.unix_timestamp;
    require_gt!(
        params.end_ts.unwrap_or(i64::MAX),
        current_ts,
        DistributionError::TimestampsNotInFuture
    );
    require_gt!(
        params.end_ts.unwrap_or(i64::MAX),
        params.start_ts,
        DistributionError::StartTimestampAfterEnd
    );
    require_gt!(
        params.total_number_recipients,
        0,
        DistributionError::NoRecipients
    );
    require_gt!(
        params.transfer_to_vault_amount,
        0,
        DistributionError::ZeroTransferAmount
    );

    require_gte!(
        BATCH_ID_MAXIMUM_LENGTH,
        params.batch_id.len(),
        DistributionError::BatchIdTooLong
    );
    require_gte!(
        params.batch_id.len(),
        BATCH_ID_MINIMUM_LENGTH,
        DistributionError::BatchIdTooShort
    );
    Ok(())
}

/// Creates a new DistributionTree
///     1. Initializes the DistributionTree PDA
///     2. Transfers the tokens from the token_source to the token_vault
pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    let distribution_tree = &mut ctx.accounts.distribution_tree;
    let authority = &ctx.accounts.authority.key();
    let bump = ctx.bumps.distribution_tree;

    distribution_tree.initialize(
        bump,
        *authority,
        params.batch_id,
        params.allow_claims,
        params.merkle_root,
        ctx.accounts.mint.key(),
        ctx.accounts.token_vault.key(),
        params.total_number_recipients,
        params.start_ts,
        params.end_ts,
        params.gatekeeper_network,
    )?;

    ctx.accounts
        .transfer_to_vault(params.transfer_to_vault_amount, params.mint_decimals)?;

    let fee_amount = calculate_fee(params.transfer_to_vault_amount)?;

    if fee_amount > 0 {
        ctx.accounts.pay_fees(fee_amount, params.mint_decimals)?;
    }

    msg!(
        "Distribution tree initialized for {} recipients",
        params.total_number_recipients
    );

    Ok(())
}
