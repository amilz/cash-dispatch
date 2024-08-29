import { BN, web3 } from "@coral-xyz/anchor";

export interface MerkleDistributorInfo {
    merkleRoot: Buffer;
    tokenTotal: string;
    claims: {
        [account: string]: {
            index: number;
            amount: BN;
            proof: Buffer[];
        };
    };
}

// For Importing from JSON, CSV, TXT, etc.
export type PaymentImport = { address: string; earnings: string };
export type PaymentsImport = PaymentImport[];

interface Payment {
    account: web3.PublicKey;
    amount: BN;
}
export type Payments = Payment[];