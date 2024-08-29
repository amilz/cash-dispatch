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

const encodeURL = (baseUrl: string, searchParams: Record<string, string>) => {
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

export const confirmTransaction = async (
    connection: Connection,
    signature: string,
    commitment: Commitment = "finalized",
): Promise<string> => {
    const block = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
        {
            signature,
            ...block,
        },
        commitment,
    );
    return signature;
};

export const getSimulationComputeUnits = async (
    connection: Connection,
    instructions: Array<TransactionInstruction>,
    payer: PublicKey,
    lookupTables: Array<AddressLookupTableAccount> | [],
): Promise<number | null> => {
    const testInstructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
        ...instructions,
    ];

    const testTransaction = new VersionedTransaction(
        new TransactionMessage({
            instructions: testInstructions,
            payerKey: payer,
            recentBlockhash: PublicKey.default.toString(),
        }).compileToV0Message(lookupTables),
    );

    const rpcResponse = await connection.simulateTransaction(testTransaction, {
        replaceRecentBlockhash: true,
        sigVerify: false,
    });
    return rpcResponse.value.unitsConsumed || null;
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

    const mintLength = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLength = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
    const mintLamports = await connection.getMinimumBalanceForRentExemption(
        mintLength + metadataLength,
    );


    const mintTransaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: mintAuthority.publicKey,
            newAccountPubkey: mint.publicKey,
            space: mintLength,
            lamports: mintLamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),

        createInitializeMetadataPointerInstruction(
            mint.publicKey,
            mintAuthority.publicKey,
            mint.publicKey,
            TOKEN_2022_PROGRAM_ID,
        ),

        createInitializeMintInstruction(
            mint.publicKey,
            decimals,
            mintAuthority.publicKey,
            freezeAuthority,
            TOKEN_2022_PROGRAM_ID,
        ),

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
                if (statuses.value && statuses.value.every((s) => s && s.confirmationStatus && validConfirmations.includes(s.confirmationStatus))) {
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