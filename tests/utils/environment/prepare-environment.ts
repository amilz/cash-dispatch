import * as anchor from '@coral-xyz/anchor';
import { TestEnvironment } from './test-environment';
import { Distributor } from "../../../target/types/distributor";
import * as web3 from '@solana/web3.js';
import { airdropToMultiple, makeTokenMint } from '../solana-helpers';
import { BASE_PAYMENT_AMOUNT, INITIAL_SOL_BALANCE, INITIAL_TOKEN_BALANCE, NUM_SAMPLE_BALANCES, PY_USD_SECRET } from '../constants';
import { createAssociatedTokenAccountIdempotent, mintTo, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { PaymentTree, PaymentsImport, parsePaymentMap } from '../merkle-tree';
import { getDistributionTreePDA, getTokenVaultAddress } from '../pdas';

export async function initEnviroment(testEnv: TestEnvironment, numPayments: number = NUM_SAMPLE_BALANCES) {
    try {
        const provider = anchor.AnchorProvider.env();

        anchor.setProvider(provider);
        testEnv.provider = provider;
        testEnv.program = anchor.workspace.Distributor as anchor.Program<Distributor>;

        await airdropToMultiple(
            [testEnv.authority.publicKey, testEnv.pyUsdMintAuthorityKeypair.publicKey],
            provider.connection,
            INITIAL_SOL_BALANCE * web3.LAMPORTS_PER_SOL
        );
        
        testEnv.pyUsdMint = await makeTokenMint({
            connection: provider.connection,
            mintAuthority: testEnv.pyUsdMintAuthorityKeypair,
            name: "PayPal USD",
            symbol: "PYUSD",
            decimals: 6,
            uri: "https://token-metadata.paxos.com/pyusd_metadata/prod/solana/pyusd_metadata.json",
            mint: web3.Keypair.fromSecretKey(new Uint8Array(PY_USD_SECRET)),
        });

        testEnv.tokenSource = await createAssociatedTokenAccountIdempotent(
            provider.connection,
            testEnv.authority,
            testEnv.pyUsdMint,
            testEnv.authority.publicKey,
            { commitment: 'processed', skipPreflight: true },
            TOKEN_2022_PROGRAM_ID
        );

        await mintTo(
            testEnv.provider.connection,
            testEnv.authority,
            testEnv.pyUsdMint,
            testEnv.tokenSource,
            testEnv.pyUsdMintAuthorityKeypair,
            INITIAL_TOKEN_BALANCE,
            [],
            { commitment: 'processed', skipPreflight: true },
            TOKEN_2022_PROGRAM_ID
        );

        const samplePayments: PaymentsImport = Array.from({ length: numPayments }, (_, i) => ({
            address: web3.Keypair.generate().publicKey.toBase58(),
            earnings: ((i + 1) * BASE_PAYMENT_AMOUNT).toString(),
        }));
        testEnv.merkleDistributorInfo = parsePaymentMap(samplePayments);

        testEnv.balanceTree = new PaymentTree(
            samplePayments.map(({ address, earnings }, index) => ({
                account: new web3.PublicKey(address),
                amount: new anchor.BN(earnings),
            }))
        );


        const currentDate = new Date();
        const startTimestamp = Math.floor(currentDate.getTime() / 1000);
        const datePart = currentDate.toISOString().split('T')[0];
        const randomPart = Math.random().toString(36).substring(2, 6); // 4 random alphanumeric characters
        const distributionId = `${datePart}-${randomPart}`.trim();
        testEnv.distributionUniqueId = distributionId;
        testEnv.distributionStartTs = startTimestamp;
        testEnv.distributionTreePda = getDistributionTreePDA({
            distributorProgram: testEnv.program.programId,
            batchId: distributionId
        });
        testEnv.tokenVault = getTokenVaultAddress({
            mint: testEnv.pyUsdMint,
            distributionTreePDA: testEnv.distributionTreePda
        });


    } catch (error) {
        console.error('Failed to initialize test environment', error);
        throw error;
    }
}