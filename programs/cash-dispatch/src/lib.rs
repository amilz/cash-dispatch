pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("D1STwmxtNRt9NWcZThPTCLZWzVsk7pPryWz3GjVgRtzo");

#[program]
pub mod cash_dispatch {
    use super::*;

    #[access_control(instructions::initialize::validate(&ctx, &params))]
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    #[access_control(instructions::expand_distribution_tree::validate(&ctx))]
    pub fn expand_distribution_tree(
        ctx: Context<ExpandDistributionTree>,
        params: ExpandParams,
    ) -> Result<()> {
        instructions::expand_distribution_tree::handler(ctx, params)
    }

    #[access_control(instructions::distribute::validate(&ctx, &params))]
    pub fn distribute(ctx: Context<Distribute>, params: DistributeParams) -> Result<()> {
        instructions::distribute::handler(ctx, params)
    }

    #[access_control(instructions::claim::validate(&ctx, &params))]
    pub fn claim(ctx: Context<Claim>, params: ClaimParams) -> Result<()> {
        instructions::claim::handler(ctx, params)
    }

    #[access_control(instructions::cancel::validate(&ctx, &params))]
    pub fn cancel(ctx: Context<Cancel>, params: CancelParams) -> Result<()> {
        instructions::cancel::handler(ctx, params)
    }

    pub fn pause(ctx: Context<PauseResume>, params: PauseResumeParams) -> Result<()> {
        instructions::pause_unpause::handle_pause(ctx, params)
    }

    pub fn resume(ctx: Context<PauseResume>, params: PauseResumeParams) -> Result<()> {
        instructions::pause_unpause::handle_resume(ctx, params)
    }

    pub fn reclaim(ctx: Context<Reclaim>, params: ReclaimParams) -> Result<()> {
        instructions::reclaim::handler(ctx, params)
    }

    #[access_control(instructions::close::validate(&ctx, &params))]
    pub fn close(ctx: Context<Close>, params: CloseParams) -> Result<()> {
        instructions::close::handler(ctx, params)
    }
}
