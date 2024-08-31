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
pub mod distributor {
    use super::*;

    #[access_control(instructions::initialize::validate(&ctx, &params))]
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }
    #[access_control(instructions::distribute::validate(&ctx, &params))]
    pub fn distribute(ctx: Context<Distribute>, params: DistributeParams) -> Result<()> {
        instructions::distribute::handler(ctx, params)
    }

    pub fn cancel(ctx: Context<Cancel>, params: CancelParams) -> Result<()> {
        instructions::cancel::handler(ctx, params)
    }

    /* TODO: Add remaining instructions

    pub fn pause_distributions(ctx: Context<PauseDistributions>) -> Result<()> {
        instructions::pause_distributions::handler(ctx)
    }

    pub fn resume_distributions(ctx: Context<ResumeDistributions>) -> Result<()> {
        instructions::resume_distributions::handler(ctx)
    }
    
     */
}
