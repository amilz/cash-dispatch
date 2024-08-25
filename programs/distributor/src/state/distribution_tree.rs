use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct DistributionTree {
    pub bump: u8,
    pub paused: bool,
    pub authority: Pubkey,
    pub capacity: u32,
    pub merkle_root: [u8; 32],
    pub last_added: LeafDetails,
    pub last_distributed: LeafDetails,
}

#[derive(InitSpace, Default, AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct LeafDetails {
    pub index: u32,
    pub hash: [u8; 32],
}

impl DistributionTree {
    pub fn initialize(&mut self, capacity: u32, authority: Pubkey, bump: u8) -> Result<()> {
        if self.merkle_root != [0; 32] {
            return Err(ProgramError::AccountAlreadyInitialized.into());
        }

        self.merkle_root = [0; 32];
        self.last_added = LeafDetails::default();
        self.last_distributed = LeafDetails::default();
        self.capacity = capacity;
        self.paused = false;
        self.bump = bump;
        self.authority = authority;

        Ok(())
    }
}
