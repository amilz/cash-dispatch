use anchor_lang::prelude::*;

pub struct Seeds;

#[constant]
impl Seeds {
    pub const DISTRIBUTION_TREE: &'static [u8] = b"DISTRIBUTION_TREE";
}