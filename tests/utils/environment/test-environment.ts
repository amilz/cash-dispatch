import * as anchor from '@coral-xyz/anchor';
import { Distributor } from "../../../target/types/distributor";
import { PaymentTree, MerkleDistributorInfo, PaymentsImport, parsePaymentMap } from '../merkle-tree';
import { PublicKey, Keypair } from '@solana/web3.js';
import { BASE_PAYMENT_AMOUNT, FEES_WALLET_SECRET, NUM_SAMPLE_BALANCES, PY_USD_AUTH_SECRET, PY_USD_SECRET } from '../constants';
import { getDistributionTreePDA, getTokenVaultAddress } from '../pdas';
import { CivicConfig } from '../civic/types';

export class TestEnvironment {
    provider!: anchor.AnchorProvider;
    program!: anchor.Program<Distributor>;

    pyUsdMint: PublicKey;
    pyUsdMintAuthorityKeypair: Keypair;

    feesWallet: Keypair;

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

    civicConfig!: CivicConfig;

    constructor() {
        this.authority = Keypair.generate();
        this.wrongAuthority = Keypair.generate();
        this.pyUsdMintAuthorityKeypair = Keypair.fromSecretKey(new Uint8Array(PY_USD_AUTH_SECRET));
        this.pyUsdMint = Keypair.fromSecretKey(new Uint8Array(PY_USD_SECRET)).publicKey;
        this.feesWallet = Keypair.fromSecretKey(new Uint8Array(FEES_WALLET_SECRET));
    }

    async cleanup(): Promise<void> {
        // Implement cleanup logic here
        // For example, close token accounts, etc.
    }

    async newTree(params: {
        numPayments?: number,
        startOffset?: number,
    } = {}): Promise<void> {
        const {
            numPayments = NUM_SAMPLE_BALANCES,
            startOffset = -1000,
        } = params;

        let samplePayments: PaymentsImport = Array.from({ length: numPayments }, (_, i) => ({
            address: Keypair.generate(),
            earnings: ((i + 1) * BASE_PAYMENT_AMOUNT).toString(),
        }));

        this.merkleDistributorInfo = parsePaymentMap(samplePayments);

        this.balanceTree = new PaymentTree(
            samplePayments.map(({ address, earnings }, index) => ({
                account: address,
                amount: new anchor.BN(earnings),
            }))
        );

        const currentDate = new Date();
        this.distributionStartTs = Math.floor(currentDate.getTime() / 1000) + startOffset;
        const datePart = currentDate.toISOString().split('T')[0];
        const randomPart = Math.random().toString(36).substring(2, 6);
        this.distributionUniqueId = `${datePart}-${randomPart}`.trim();

        this.distributionTreePda = getDistributionTreePDA({
            distributorProgram: this.program.programId,
            batchId: this.distributionUniqueId
        });
        this.tokenVault = getTokenVaultAddress({
            mint: this.pyUsdMint,
            distributionTreePDA: this.distributionTreePda
        });
    }
}