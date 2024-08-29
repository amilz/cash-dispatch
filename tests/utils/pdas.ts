import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

const SEEDS: Record<string, string> = {
    DISTRIBUTOR: 'DISTRIBUTION_TREE',
};

export function getDistributionTreePDA({
    distributorProgram
}: {
    distributorProgram: PublicKey
}): PublicKey {
    const [distributionTreePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from(SEEDS.DISTRIBUTOR)],
        distributorProgram
    );
    return distributionTreePDA;
}

export function getTokenVaultAddress({
    mint,
    distributionTreePDA,
}: {
    mint: PublicKey,
    distributionTreePDA: PublicKey
}): PublicKey {
    return getAssociatedTokenAddressSync(
        mint,
        distributionTreePDA,
        true,
        TOKEN_2022_PROGRAM_ID
    );
}
