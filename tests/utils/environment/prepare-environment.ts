import * as anchor from '@coral-xyz/anchor';
import { TestEnvironment } from './test-environment';
import { Distributor } from "../../../target/types/distributor";
import * as web3 from '@solana/web3.js';
import { airdropToMultiple, makeTokenMint } from '../helpers';
import { INITIAL_SOL_BALANCE, PY_USD_SECRET } from '../constants';
import { createAssociatedTokenAccountIdempotent, mintTo, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

export async function initEnviroment(testEnv: TestEnvironment) {
    const provider = anchor.AnchorProvider.env();

    anchor.setProvider(provider);
    testEnv.provider = provider;
    testEnv.program = anchor.workspace.Distributor as anchor.Program<Distributor>;

    await airdropToMultiple(
        [testEnv.authority1.publicKey, testEnv.pyUsdMintAuthorityKeypair.publicKey],
        provider.connection,
        INITIAL_SOL_BALANCE * web3.LAMPORTS_PER_SOL
    )
    testEnv.pyUsdMint = await makeTokenMint({
        connection: provider.connection,
        mintAuthority: testEnv.pyUsdMintAuthorityKeypair,
        name: "PayPal USD",
        symbol: "PYUSD",
        decimals: 6,
        uri: "https://token-metadata.paxos.com/pyusd_metadata/prod/solana/pyusd_metadata.json",
        mint: web3.Keypair.fromSecretKey(new Uint8Array(PY_USD_SECRET)),
    });

    testEnv.tokenSource1 = await createAssociatedTokenAccountIdempotent(
        provider.connection,
        testEnv.authority1,
        testEnv.pyUsdMint,
        testEnv.authority1.publicKey,
        { commitment: 'processed', skipPreflight: true },
        TOKEN_2022_PROGRAM_ID
    );

    await mintTo(
        testEnv.provider.connection,
        testEnv.authority1,
        testEnv.pyUsdMint,
        testEnv.tokenSource1,
        testEnv.pyUsdMintAuthorityKeypair,
        10_000_000_000_000,
        [],
        { commitment: 'processed', skipPreflight: true },
        TOKEN_2022_PROGRAM_ID
    )

}