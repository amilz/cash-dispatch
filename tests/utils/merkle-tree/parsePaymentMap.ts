import { BN } from "@coral-xyz/anchor";
import { PaymentTree } from "./PaymentTree";
import { MerkleDistributorInfo, PaymentInfo, Payments, PaymentsImport } from "./types";

export function parsePaymentMap(paymentsImport: PaymentsImport): MerkleDistributorInfo {
    const payments: PaymentInfo[] = [];
    const treePayments: Payments = [];

    paymentsImport.forEach(({ address, earnings }, index) => {
        const amount = new BN(earnings);
        if (amount.lte(new BN(0))) {
            throw new Error(`Invalid amount for account: ${address.publicKey.toBase58()}`);
        }
        treePayments.push({ account: address, amount });
    });

    const tree = new PaymentTree(treePayments);

    payments.push(...treePayments.map(({ account, amount }, index) => ({
        index,
        amount,
        proof: tree.getProof(index, account.publicKey, amount),
        keypair: account,
    })));

    const tokenTotal = payments.reduce(
        (sum, { amount }) => sum.add(amount),
        new BN(0)
    );

    return {
        merkleRoot: tree.getRoot(),
        tokenTotal,
        payments,
    };
}