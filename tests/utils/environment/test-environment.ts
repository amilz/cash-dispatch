import * as anchor from '@coral-xyz/anchor';
import { Distributor } from "../../../target/types/distributor";
import { PaymentTree, MerkleDistributorInfo } from '../merkle-tree';
import { PublicKey, Keypair } from '@solana/web3.js';
import { PY_USD_AUTH_SECRET, PY_USD_SECRET } from '../constants';

export class TestEnvironment {
    provider!: anchor.AnchorProvider;
    program!: anchor.Program<Distributor>;

    pyUsdMint: PublicKey;
    pyUsdMintAuthorityKeypair: Keypair;

    authority: Keypair;
    wrongAuthority: Keypair;
    tokenSource!: PublicKey;

    balanceTree!: PaymentTree;
    merkleRoot!: Buffer;
    merkleDistributorInfo!: MerkleDistributorInfo;
    distributionTreePda!: PublicKey;
    tokenVault!: PublicKey;
    distributionStartTs!: number;
    distributionUniqueId!: string;

    constructor() {
        this.authority = Keypair.generate();
        this.wrongAuthority = Keypair.generate();
        this.pyUsdMintAuthorityKeypair = Keypair.fromSecretKey(new Uint8Array(PY_USD_AUTH_SECRET));
        this.pyUsdMint = Keypair.fromSecretKey(new Uint8Array(PY_USD_SECRET)).publicKey;
    }

    async cleanup(): Promise<void> {
        // Implement cleanup logic here
        // For example, close token accounts, etc.
    }
}