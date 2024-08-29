import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { PaymentTree } from "./PaymentTree";
import { MerkleDistributorInfo, PaymentsImport } from "./types";

export function parsePaymentMap(paymentsImport: PaymentsImport): MerkleDistributorInfo {
    const dataByAddress = new Map<string, { amount: BN }>();

    for (const { address, earnings } of paymentsImport) {
        if (dataByAddress.has(address)) {
            throw new Error(`Duplicate address: ${address}`);
        }
        const amount = new BN(earnings);
        if (amount.lte(new BN(0))) {
            throw new Error(`Invalid amount for account: ${address}`);
        }
        dataByAddress.set(address, { amount });
    }

    const sortedAddresses = Array.from(dataByAddress.keys()).sort();

    const tree = new PaymentTree(
        sortedAddresses.map((address) => ({
            account: new PublicKey(address),
            amount: dataByAddress.get(address)!.amount,
        }))
    );

    const payments: MerkleDistributorInfo["payments"] = {};
    for (let i = 0; i < sortedAddresses.length; i++) {
        const address = sortedAddresses[i];
        const { amount } = dataByAddress.get(address)!;
        payments[address] = {
            index: i,
            amount: amount,
            proof: tree.getProof(i, new PublicKey(address), amount),
        };
    }

    const tokenTotal = sortedAddresses.reduce(
        (sum, addr) => sum.add(dataByAddress.get(addr)!.amount),
        new BN(0)
    );

    return {
        merkleRoot: tree.getRoot(),
        tokenTotal: tokenTotal.toString(),
        payments,
    };
}
