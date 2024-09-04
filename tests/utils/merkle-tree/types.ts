import { BN, web3 } from "@coral-xyz/anchor";

export interface PaymentInfo {
    index: number;
    keypair: web3.Keypair;
    amount: BN;
    proof: Buffer[];
}

export interface MerkleDistributorInfo {
    merkleRoot: Buffer;
    tokenTotal: BN;
    payments: PaymentInfo[];
}

// For Importing from JSON, CSV, TXT, etc.
export type PaymentImport = { address: web3.Keypair; earnings: string };
export type PaymentsImport = PaymentImport[];

interface Payment {
    account: web3.Keypair;
    amount: BN;
}
export type Payments = Payment[];