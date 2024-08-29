import { PublicKey } from "@solana/web3.js";
import { keccak_256 } from "js-sha3";
import { BN } from "@coral-xyz/anchor";     
import { MerkleTree } from "./MerkleTree";
import { Payments } from "./types";

export class PaymentTree {
    private readonly tree: MerkleTree;

    constructor(payments: Payments) {
        this.tree = new MerkleTree(
            payments.map(({ account, amount }, index) =>
                PaymentTree.toNode(index, account, amount)
            )
        );
    }

    static verifyProof(
        index: number,
        account: PublicKey,
        amount: BN,
        proof: Buffer[],
        root: Buffer
    ): boolean {
        let pair = PaymentTree.toNode(index, account, amount);
        for (const item of proof) {
            pair = MerkleTree.combinedHash(pair, item);
        }
        return pair.equals(root);
    }

    static toNode(index: number, account: PublicKey, amount: BN): Buffer {
        const buf = Buffer.concat([
            Buffer.from(new BN(index).toArray("le", 8)),
            account.toBuffer(),
            Buffer.from(amount.toArray("le", 8)),
        ]);
        return Buffer.from(keccak_256(buf), "hex");
    }

    getHexRoot(): string {
        return this.tree.getHexRoot();
    }

    getHexProof(index: number, account: PublicKey, amount: BN): string[] {
        return this.tree.getHexProof(PaymentTree.toNode(index, account, amount));
    }

    getRoot(): Buffer {
        return this.tree.getRoot();
    }

    getProof(index: number, account: PublicKey, amount: BN): Buffer[] {
        return this.tree.getProof(PaymentTree.toNode(index, account, amount));
    }
}