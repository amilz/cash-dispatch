import * as anchor from '@coral-xyz/anchor';
import { TestEnvironment } from './test-environment';
import { Distributor } from "../../../target/types/distributor";
import * as web3 from '@solana/web3.js';
import { airdropToMultiple, makeTokenMint } from '../solana-helpers';
import { INITIAL_SOL_BALANCE, INITIAL_TOKEN_BALANCE, NUM_SAMPLE_BALANCES, PY_USD_SECRET } from '../constants';
import { createAssociatedTokenAccountIdempotent, mintTo, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { addGateKeeper, setupCivcPass } from '../civic/setup';

interface InitEnvironmentParams {
    testEnv: TestEnvironment;
    numPayments?: number;
    skipInitMint?: boolean;
    startOffset?: number;
}

export async function initEnviroment({
    testEnv,
    numPayments = NUM_SAMPLE_BALANCES,
    skipInitMint = false,
    startOffset = -1000
}: InitEnvironmentParams) {
    try {
        const provider = anchor.AnchorProvider.env();

        anchor.setProvider(provider);
        testEnv.provider = provider;
        testEnv.program = anchor.workspace.Distributor as anchor.Program<Distributor>;

        testEnv.civicConfig = setupCivcPass(provider.connection);

        await airdropToMultiple(
            [
                testEnv.authority.publicKey,
                testEnv.pyUsdMintAuthorityKeypair.publicKey,
                testEnv.wrongAuthority.publicKey,
                testEnv.civicConfig.gatekeeper.publicKey,
                testEnv.civicConfig.gatekeeperNetwork.publicKey,
                testEnv.feesWallet.publicKey,
            ],
            provider.connection,
            INITIAL_SOL_BALANCE * web3.LAMPORTS_PER_SOL
        );

        await addGateKeeper(testEnv);

        if (!skipInitMint) {
            await makeTokenMint({
                connection: provider.connection,
                mintAuthority: testEnv.pyUsdMintAuthorityKeypair,
                name: "PayPal USD",
                symbol: "PYUSD",
                decimals: 6,
                uri: "https://token-metadata.paxos.com/pyusd_metadata/prod/solana/pyusd_metadata.json",
                mint: web3.Keypair.fromSecretKey(new Uint8Array(PY_USD_SECRET)),
            });
        }


        [testEnv.tokenSource] = await Promise.all([
            createAssociatedTokenAccountIdempotent(
                provider.connection,
                testEnv.authority,
                testEnv.pyUsdMint,
                testEnv.authority.publicKey,
                { commitment: 'processed', skipPreflight: true },
                TOKEN_2022_PROGRAM_ID
            ),
            createAssociatedTokenAccountIdempotent(
                provider.connection,
                testEnv.feesWallet,
                testEnv.pyUsdMint,
                testEnv.feesWallet.publicKey,
                { commitment: 'processed', skipPreflight: true },
                TOKEN_2022_PROGRAM_ID
            ),
        ]);


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

        await testEnv.newTree({ numPayments, startOffset });
    } catch (error) {
        console.error('Failed to initialize test environment', error);
        throw error;
    }
}