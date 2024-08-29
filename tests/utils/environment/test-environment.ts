import * as anchor from '@coral-xyz/anchor';
import { Distributor } from "../../../target/types/distributor";
import { PaymentTree, MerkleDistributorInfo } from '../merkle-tree';
import { PublicKey, Keypair } from '@solana/web3.js';

export class TestEnvironment {
    provider!: anchor.AnchorProvider;
    program!: anchor.Program<Distributor>;

    pyUsdMint!: PublicKey;
    pyUsdMintAuthorityKeypair: Keypair;

    authority: Keypair;
    tokenSource!: PublicKey;

    balanceTree!: PaymentTree;
    merkleRoot!: Buffer;
    merkleDistributorInfo!: MerkleDistributorInfo;

    constructor() {
        this.authority = Keypair.generate();
        this.pyUsdMintAuthorityKeypair = Keypair.generate();
    }

    async cleanup(): Promise<void> {
        // Implement cleanup logic here
        // For example, close token accounts, etc.
    }
}