import { BN, web3 } from "@coral-xyz/anchor";

export interface PaymentInfo {
    index: number;
    account: string;
    amount: BN;
    proof: Buffer[];
}

export interface MerkleDistributorInfo {
    merkleRoot: Buffer;
    tokenTotal: BN;
    payments: PaymentInfo[];
}

// For Importing from JSON, CSV, TXT, etc.
export type PaymentImport = { address: string; earnings: string };
export type PaymentsImport = PaymentImport[];

interface Payment {
    account: web3.PublicKey;
    amount: BN;
}
export type Payments = Payment[];