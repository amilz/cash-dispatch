import {
    Cluster,
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
    TransactionInstruction,
    AddressLookupTableAccount,
    ComputeBudgetProgram,
    VersionedTransaction,
    TransactionMessage,
    RpcResponseAndContext,
    SignatureResult,
    SimulatedTransactionResponse,
    SystemProgram,
    Signer,
    Commitment,
    Transaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import base58 from "bs58";
import {
    TOKEN_PROGRAM_ID,
    MINT_SIZE,
    createAssociatedTokenAccountIdempotentInstruction,
    createInitializeMint2Instruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    getMinimumBalanceForRentExemptMint,
    TOKEN_2022_PROGRAM_ID,
    createInitializeMetadataPointerInstruction,
    createInitializeMintInstruction,
    ExtensionType,
    getMintLen,
    LENGTH_SIZE,
    TYPE_SIZE,
} from "@solana/spl-token";
import type { TokenMetadata } from "@solana/spl-token-metadata";
import {
    createInitializeInstruction,
    createUpdateFieldInstruction,
    pack,
} from "@solana/spl-token-metadata";

// Default value from Solana CLI
const DEFAULT_FILEPATH = "~/.config/solana/id.json";
const DEFAULT_AIRDROP_AMOUNT = 1 * LAMPORTS_PER_SOL;
const DEFAULT_MINIMUM_BALANCE = 0.5 * LAMPORTS_PER_SOL;
const DEFAULT_ENV_KEYPAIR_VARIABLE_NAME = "PRIVATE_KEY";

const log = console.log;

const TOKEN_PROGRAM: typeof TOKEN_2022_PROGRAM_ID | typeof TOKEN_PROGRAM_ID =
    TOKEN_2022_PROGRAM_ID;

const getErrorFromRPCResponse = (
    rpcResponse: RpcResponseAndContext<
        SignatureResult | SimulatedTransactionResponse
    >,
) => {
    // Note: `confirmTransaction` does not throw an error if the confirmation does not succeed,
    // but rather a `TransactionError` object. so we handle that here
    // See https://solana-labs.github.io/solana-web3.js/classes/Connection.html#confirmTransaction.confirmTransaction-1

    const error = rpcResponse.value.err;
    if (error) {
        // Can be a string or an object (literally just {}, no further typing is provided by the library)
        // https://github.com/solana-labs/solana-web3.js/blob/4436ba5189548fc3444a9f6efb51098272926945/packages/library-legacy/src/connection.ts#L2930
        // TODO: if still occurs in web3.js 2 (unlikely), fix it.
        if (typeof error === "object") {
            const errorKeys = Object.keys(error);
            if (errorKeys.length === 1) {
                if (errorKeys[0] !== "InstructionError") {
                    throw new Error(`Unknown RPC error: ${error}`);
                }
                // @ts-ignore due to missing typing information mentioned above.
                const instructionError = error["InstructionError"];
                // An instruction error is a custom program error and looks like:
                // [
                //   1,
                //   {
                //     "Custom": 1
                //   }
                // ]
                // See also https://solana.stackexchange.com/a/931/294
                throw new Error(
                    `Error in transaction: instruction index ${instructionError[0]}, custom program error ${instructionError[1]["Custom"]}`,
                );
            }
        }
        throw Error(error.toString());
    }
};

export const keypairToSecretKeyJSON = (keypair: Keypair): string => {
    return JSON.stringify(Array.from(keypair.secretKey));
};

/*   export const getCustomErrorMessage = (
    possibleProgramErrors: Array<string>,
    errorMessage: string,
  ): string | null => {
    const customErrorExpression =
      /.*custom program error: 0x(?<errorNumber>[0-9abcdef]+)/;
  
    let match = customErrorExpression.exec(errorMessage);
    const errorNumberFound = match?.groups?.errorNumber;
    if (!errorNumberFound) {
      return null;
    }
    // errorNumberFound is a base16 string
    const errorNumber = parseInt(errorNumberFound, 16);
    return possibleProgramErrors[errorNumber] || null;
  }; */

const encodeURL = (baseUrl: string, searchParams: Record<string, string>) => {
    // This was a little new to me, but it's the
    // recommended way to build URLs with query params
    // (and also means you don't have to do any encoding)
    // https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
    const url = new URL(baseUrl);
    url.search = new URLSearchParams(searchParams).toString();
    return url.toString();
};

export const getExplorerLink = (
    linkType: "transaction" | "tx" | "address" | "block",
    id: string,
    cluster: Cluster | "localnet" = "mainnet-beta",
): string => {
    const searchParams: Record<string, string> = {};
    if (cluster !== "mainnet-beta") {
        if (cluster === "localnet") {
            // localnet technically isn't a cluster, so requires special handling
            searchParams["cluster"] = "custom";
            searchParams["customUrl"] = "http://localhost:8899";
        } else {
            searchParams["cluster"] = cluster;
        }
    }
    let baseUrl: string = "";
    if (linkType === "address") {
        baseUrl = `https://explorer.solana.com/address/${id}`;
    }
    if (linkType === "transaction" || linkType === "tx") {
        baseUrl = `https://explorer.solana.com/tx/${id}`;
    }
    if (linkType === "block") {
        baseUrl = `https://explorer.solana.com/block/${id}`;
    }
    return encodeURL(baseUrl, searchParams);
};

export const getKeypairFromFile = async (filepath?: string) => {
    const path = await import("path");
    // Work out correct file name
    if (!filepath) {
        filepath = DEFAULT_FILEPATH;
    }
    if (filepath[0] === "~") {
        const home = process.env.HOME || null;
        if (home) {
            filepath = path.join(home, filepath.slice(1));
        }
    }

    // Get contents of file
    let fileContents: string;
    try {
        const { readFile } = await import("fs/promises");
        const fileContentsBuffer = await readFile(filepath);
        fileContents = fileContentsBuffer.toString();
    } catch (error) {
        throw new Error(`Could not read keypair from file at '${filepath}'`);
    }

    // Parse contents of file
    let parsedFileContents: Uint8Array;
    try {
        parsedFileContents = Uint8Array.from(JSON.parse(fileContents));
    } catch (thrownObject) {
        const error = thrownObject as Error;
        if (!error.message.includes("Unexpected token")) {
            throw error;
        }
        throw new Error(`Invalid secret key file at '${filepath}'!`);
    }
    return Keypair.fromSecretKey(parsedFileContents);
};

export const getKeypairFromEnvironment = (variableName: string) => {
    const secretKeyString = process.env[variableName];
    if (!secretKeyString) {
        throw new Error(`Please set '${variableName}' in environment.`);
    }

    // Try the shorter base58 format first
    let decodedSecretKey: Uint8Array;
    try {
        decodedSecretKey = base58.decode(secretKeyString);
        return Keypair.fromSecretKey(decodedSecretKey);
    } catch (throwObject) {
        const error = throwObject as Error;
        if (!error.message.includes("Non-base58 character")) {
            throw new Error(
                `Invalid secret key in environment variable '${variableName}'!`,
            );
        }
    }

    // Try the longer JSON format
    try {
        decodedSecretKey = Uint8Array.from(JSON.parse(secretKeyString));
    } catch (error) {
        throw new Error(
            `Invalid secret key in environment variable '${variableName}'!`,
        );
    }
    return Keypair.fromSecretKey(decodedSecretKey);
};

export const addKeypairToEnvFile = async (
    keypair: Keypair,
    variableName: string,
    envFileName?: string,
) => {
    const { appendFile } = await import("fs/promises");
    if (!envFileName) {
        envFileName = ".env";
    }
    const existingSecretKey = process.env[variableName];
    if (existingSecretKey) {
        throw new Error(`'${variableName}' already exists in env file.`);
    }
    const secretKeyString = keypairToSecretKeyJSON(keypair);
    await appendFile(
        envFileName,
        `\n# Solana Address: ${keypair.publicKey.toBase58()}\n${variableName}=${secretKeyString}`,
    );
};

export interface InitializeKeypairOptions {
    envFileName?: string;
    envVariableName?: string;
    airdropAmount?: number | null;
    minimumBalance?: number;
    keypairPath?: string;
}

export const initializeKeypair = async (
    connection: Connection,
    options?: InitializeKeypairOptions,
): Promise<Keypair> => {
    let {
        keypairPath,
        envFileName,
        envVariableName = DEFAULT_ENV_KEYPAIR_VARIABLE_NAME,
        airdropAmount = DEFAULT_AIRDROP_AMOUNT,
        minimumBalance = DEFAULT_MINIMUM_BALANCE,
    } = options || {};

    let keypair: Keypair;

    if (keypairPath) {
        keypair = await getKeypairFromFile(keypairPath);
    } else if (process.env[envVariableName]) {
        keypair = getKeypairFromEnvironment(envVariableName);
    } else {
        keypair = Keypair.generate();
        await addKeypairToEnvFile(keypair, envVariableName, envFileName);
    }

    if (airdropAmount) {
        await airdropIfRequired(
            connection,
            keypair.publicKey,
            airdropAmount,
            minimumBalance,
        );
    }

    return keypair;
};

// Not exported as we don't want to encourage people to
// request airdrops when they don't need them, ie - don't bother
// the faucet unless you really need to!
const requestAndConfirmAirdrop = async (
    connection: Connection,
    publicKey: PublicKey,
    amount: number,
) => {
    const airdropTransactionSignature = await connection.requestAirdrop(
        publicKey,
        amount,
    );
    // Wait for airdrop confirmation
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
        {
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature: airdropTransactionSignature,
        },
        // "finalized" is slow but we must be absolutely sure
        // the airdrop has gone through
        "finalized",
    );
    return connection.getBalance(publicKey, "finalized");
};

export const airdropIfRequired = async (
    connection: Connection,
    publicKey: PublicKey,
    airdropAmount: number,
    minimumBalance: number,
): Promise<number> => {
    const balance = await connection.getBalance(publicKey, "confirmed");
    if (balance < minimumBalance) {
        return requestAndConfirmAirdrop(connection, publicKey, airdropAmount);
    }
    return balance;
};

export const confirmTransaction = async (
    connection: Connection,
    signature: string,
    commitment: Commitment = "finalized",
): Promise<string> => {
    const block = await connection.getLatestBlockhash();
    const rpcResponse = await connection.confirmTransaction(
        {
            signature,
            ...block,
        },
        commitment,
    );

    getErrorFromRPCResponse(rpcResponse);

    return signature;
};

// Shout out to Dean from WBA for this technique
export const makeKeypairs = (amount: number): Array<Keypair> => {
    return Array.from({ length: amount }, () => Keypair.generate());
};

export const getLogs = async (
    connection: Connection,
    tx: string,
): Promise<Array<string>> => {
    await confirmTransaction(connection, tx);
    const txDetails = await connection.getTransaction(tx, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
    });
    return txDetails?.meta?.logMessages || [];
};

// Was getSimulationUnits
// Credit https://twitter.com/stegabob, originally from
// https://x.com/stegaBOB/status/1766662289392889920
export const getSimulationComputeUnits = async (
    connection: Connection,
    instructions: Array<TransactionInstruction>,
    payer: PublicKey,
    lookupTables: Array<AddressLookupTableAccount> | [],
): Promise<number | null> => {
    const testInstructions = [
        // Set an arbitrarily high number in simulation
        // so we can be sure the transaction will succeed
        // and get the real compute units used
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
        ...instructions,
    ];

    const testTransaction = new VersionedTransaction(
        new TransactionMessage({
            instructions: testInstructions,
            payerKey: payer,
            // RecentBlockhash can by any public key during simulation
            // since 'replaceRecentBlockhash' is set to 'true' below
            recentBlockhash: PublicKey.default.toString(),
        }).compileToV0Message(lookupTables),
    );

    const rpcResponse = await connection.simulateTransaction(testTransaction, {
        replaceRecentBlockhash: true,
        sigVerify: false,
    });

    getErrorFromRPCResponse(rpcResponse);
    return rpcResponse.value.unitsConsumed || null;
};

// Just a non-exposed helper function to create all the instructions instructions
// needed for creating a mint, creating an ATA, and minting tokens to the ATA
// TODO: maybe we should expose this? To discuss.
const makeMintInstructions = (
    mintAddress: PublicKey,
    ataAddress: PublicKey,
    amount: number | bigint,
    authority: PublicKey,
    payer: PublicKey = authority,
): Array<TransactionInstruction> => {
    return [
        // Initializes a new mint and optionally deposits all the newly minted tokens in an account.
        createInitializeMint2Instruction(
            mintAddress,
            6,
            authority,
            null,
            TOKEN_PROGRAM,
        ),
        // Create the ATA
        createAssociatedTokenAccountIdempotentInstruction(
            payer,
            ataAddress,
            authority,
            mintAddress,
            TOKEN_PROGRAM,
        ),
        // Mint some tokens to the ATA
        createMintToInstruction(
            mintAddress,
            ataAddress,
            authority,
            amount,
            [],
            TOKEN_PROGRAM,
        ),
    ];
};

// Send a versioned transaction with less boilerplate
// https://www.quicknode.com/guides/solana-development/transactions/how-to-use-versioned-transactions-on-solana
// TODO: maybe we should expose this? To discuss.
const makeAndSendAndConfirmTransaction = async (
    connection: Connection,
    instructions: Array<TransactionInstruction>,
    signers: Array<Signer>,
    payer: Keypair,
) => {
    const latestBlockhash = (await connection.getLatestBlockhash("max"))
        .blockhash;

    const messageV0 = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: latestBlockhash,
        instructions,
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign(signers);

    const signature = await connection.sendTransaction(transaction);

    await confirmTransaction(connection, signature);
};

// Create users, mints, create ATAs and mint tokens.
// TODO: we may actually want to split this into multiple transactions
// to avoid the transaction size limit (or use lookup tables)
// in the future. However it works for two transactions of the size
// used in our unit tests.
export const createAccountsMintsAndTokenAccounts = async (
    usersAndTokenBalances: Array<Array<number>>,
    lamports: number,
    connection: Connection,
    payer: Keypair,
) => {
    const userCount = usersAndTokenBalances.length;
    // Set the variable mintCount to the largest array in the usersAndTokenBalances array
    const mintCount = Math.max(
        ...usersAndTokenBalances.map((mintBalances) => mintBalances.length),
    );

    const users = makeKeypairs(userCount);
    const mints = makeKeypairs(mintCount);

    // This will be returned
    // [user index][mint index]address of token account
    let tokenAccounts: Array<Array<PublicKey>>;

    tokenAccounts = users.map((user) => {
        return mints.map((mint) =>
            getAssociatedTokenAddressSync(
                mint.publicKey,
                user.publicKey,
                false,
                TOKEN_PROGRAM,
            ),
        );
    });

    const sendSolInstructions: Array<TransactionInstruction> = users.map((user) =>
        SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: user.publicKey,
            lamports,
        }),
    );

    // Airdrops to user
    const minimumLamports = await getMinimumBalanceForRentExemptMint(connection);

    const createMintInstructions: Array<TransactionInstruction> = mints.map(
        (mint) =>
            SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: mint.publicKey,
                lamports: minimumLamports,
                space: MINT_SIZE,
                programId: TOKEN_PROGRAM,
            }),
    );

    // Make tokenA and tokenB mints, mint tokens and create ATAs
    const mintTokensInstructions: Array<TransactionInstruction> =
        usersAndTokenBalances.flatMap((userTokenBalances, userIndex) => {
            return userTokenBalances.flatMap((tokenBalance, mintIndex) => {
                if (tokenBalance === 0) {
                    return [];
                }
                return makeMintInstructions(
                    mints[mintIndex].publicKey,
                    tokenAccounts[userIndex][mintIndex],
                    tokenBalance,
                    users[userIndex].publicKey,
                    payer.publicKey,
                );
            });
        });

    const instructions = [
        ...sendSolInstructions,
        ...createMintInstructions,
        ...mintTokensInstructions,
    ];

    const signers = [...users, ...mints, payer];

    // Finally, make the transaction and send it.
    await makeAndSendAndConfirmTransaction(
        connection,
        instructions,
        signers,
        payer,
    );

    return {
        users,
        mints,
        tokenAccounts,
    };
};

interface MakeTokenMintParams {
    connection: Connection;
    mintAuthority: Keypair;
    name: string;
    symbol: string;
    decimals: number;
    uri: string;
    mint?: Keypair;
    additionalMetadata?: Array<[string, string]> | Record<string, string>;
    updateAuthority?: PublicKey;
    freezeAuthority?: PublicKey | null;
}

export const makeTokenMint = async ({
    connection,
    mintAuthority,
    name,
    symbol,
    decimals,
    uri,
    mint = Keypair.generate(),
    additionalMetadata = [],
    updateAuthority = mintAuthority.publicKey,
    freezeAuthority = null,
}: MakeTokenMintParams) => {

    if (!Array.isArray(additionalMetadata)) {
        additionalMetadata = Object.entries(additionalMetadata);
    }

    const addMetadataInstructions = additionalMetadata.map(
        (additionalMetadataItem) => {
            return createUpdateFieldInstruction({
                metadata: mint.publicKey,
                updateAuthority: updateAuthority,
                programId: TOKEN_2022_PROGRAM_ID,
                field: additionalMetadataItem[0],
                value: additionalMetadataItem[1],
            });
        },
    );

    const metadata: TokenMetadata = {
        mint: mint.publicKey,
        name,
        symbol,
        uri,
        additionalMetadata,
    };

    // Work out how much SOL we need to store our Token
    const mintLength = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLength = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
    const mintLamports = await connection.getMinimumBalanceForRentExemption(
        mintLength + metadataLength,
    );


    const mintTransaction = new Transaction().add(
        // Create Account
        SystemProgram.createAccount({
            fromPubkey: mintAuthority.publicKey,
            newAccountPubkey: mint.publicKey,
            space: mintLength,
            lamports: mintLamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),

        // Initialize metadata pointer (so the mint points to itself for metadata)
        createInitializeMetadataPointerInstruction(
            mint.publicKey,
            mintAuthority.publicKey,
            mint.publicKey,
            TOKEN_2022_PROGRAM_ID,
        ),

        // Initialize mint
        createInitializeMintInstruction(
            mint.publicKey,
            decimals,
            mintAuthority.publicKey,
            freezeAuthority,
            TOKEN_2022_PROGRAM_ID,
        ),

        // Initialize
        createInitializeInstruction({
            programId: TOKEN_2022_PROGRAM_ID,
            mint: mint.publicKey,
            metadata: mint.publicKey,
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            mintAuthority: mintAuthority.publicKey,
            updateAuthority: updateAuthority,
        }),

        // Update field (actually used to add a custom field)
        // See https://github.com/solana-labs/solana-program-library/blob/master/token/js/examples/metadata.ts#L81C6-L81C6
        // Must come last!
        ...addMetadataInstructions,
    );

    const { blockhash } = await connection.getLatestBlockhash();
    mintTransaction.recentBlockhash = blockhash;
    mintTransaction.feePayer = mintAuthority.publicKey;
    try {
        await sendAndConfirmTransaction(
            connection,
            mintTransaction,
            [mintAuthority, mint],
            { commitment: 'processed', skipPreflight: true },
        );
    } catch (error) {
        console.log(error);
    }


    return mint.publicKey;
};

/**
 * Airdrops SOL to an array of public keys.
 * @param {PublicKey[]} pubkeys Array of PublicKey objects to receive the airdrop.
 * @param {Connection} connection Solana connection object.
 * @param {number} amount Amount of lamports to airdrop to each pubkey.
 * @returns {Promise<void>} A promise that resolves when all airdrops are confirmed.
 * 
 * Usage Example:
 * const wallet1 = Keypair.generate();
 * const wallet2 = Keypair.generate();
 * const wallet3 = Keypair.generate();
 * const wallets = [wallet1.publicKey, wallet2.publicKey, wallet3.publicKey];
 * await airdropToMultiple(wallets, connection, LAMPORTS_PER_SOL);
 */
export async function airdropToMultiple(
    pubkeys: PublicKey[],
    connection: Connection,
    amount: number
): Promise<void> {
    try {
        const airdropPromises = pubkeys.map((pubkey) =>
            connection.requestAirdrop(pubkey, amount)
        );
        const airdropTxns = await Promise.all(airdropPromises);

        let confirmed: boolean = false;
        while (!confirmed) {
            const validConfirmations = ["processed", "confirmed", "finalized"];
            const startTime = Date.now();
            while (true) {
                const statuses = await connection.getSignatureStatuses(airdropTxns);
                if (statuses.value && statuses.value.every((s) => s && validConfirmations.includes(s.confirmationStatus))) {
                    confirmed = true;
                    break;
                } 
                if (Date.now() - startTime > 30000) {
                    throw new Error("Airdrop timeout");
                }
                await sleep(1000);
            }
        }

    } catch (error) {
        return Promise.reject(error);
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}