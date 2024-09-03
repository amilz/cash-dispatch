import { keccak_256 } from "js-sha3";
import { MerkleDistributorInfo, PaymentInfo } from "./types";
import { BN } from "@coral-xyz/anchor";

export class MerkleTree {
    private readonly elements: Buffer[];
    private readonly bufferElementPositionIndex: Map<string, number>;
    private readonly layers: Buffer[][];

    constructor(elements: Buffer[]) {
        this.elements = [...elements].sort(Buffer.compare);
        this.elements = MerkleTree.bufDedup(this.elements);

        this.bufferElementPositionIndex = new Map(
            this.elements.map((el, index) => [el.toString("hex"), index])
        );

        this.layers = this.getLayers(this.elements);
    }

    getLayers(elements: Buffer[]): Buffer[][] {
        if (elements.length === 0) {
            throw new Error("empty tree");
        }

        const layers = [elements];

        while (layers[layers.length - 1].length > 1) {
            layers.push(this.getNextLayer(layers[layers.length - 1]));
        }

        return layers;
    }

    getNextLayer(elements: Buffer[]): Buffer[] {
        return elements.reduce<Buffer[]>((layer, el, idx, arr) => {
            if (idx % 2 === 0) {
                layer.push(MerkleTree.combinedHash(el, arr[idx + 1]));
            }
            return layer;
        }, []);
    }

    static combinedHash(first: Buffer, second?: Buffer): Buffer {
        if (!first) {
            return second!;
        }
        if (!second) {
            return first;
        }
        return Buffer.from(
            keccak_256(Buffer.concat([first, second].sort(Buffer.compare))),
            "hex"
        );
    }

    getRoot(): Buffer {
        return this.layers[this.layers.length - 1][0];
    }

    getHexRoot(): string {
        return this.getRoot().toString("hex");
    }

    getProof(el: Buffer): Buffer[] {
        let idx = this.bufferElementPositionIndex.get(el.toString("hex"));

        if (typeof idx !== "number") {
            throw new Error("Element does not exist in Merkle tree");
        }

        return this.layers.reduce<Buffer[]>((proof, layer) => {
            const pairElement = MerkleTree.getPairElement(idx!, layer);
            if (pairElement) {
                proof.push(pairElement);
            }
            idx = Math.floor(idx! / 2);
            return proof;
        }, []);
    }

    getHexProof(el: Buffer): string[] {
        return this.getProof(el).map((element) => element.toString("hex"));
    }

    private static getPairElement(idx: number, layer: Buffer[]): Buffer | null {
        const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
        return pairIdx < layer.length ? layer[pairIdx] : null;
    }

    private static bufDedup(elements: Buffer[]): Buffer[] {
        return elements.filter((el, idx) =>
            idx === 0 || !elements[idx - 1].equals(el)
        );
    }
}

export function getAccountByIndex(
    distributorInfo: MerkleDistributorInfo,
    targetIndex: number
): PaymentInfo | undefined {
    return distributorInfo.payments.find(paymentInfo => paymentInfo.index === targetIndex);
}

export function isBitSet(bitmap: BN[], index: number): boolean {
    const bitmapIndex = Math.floor(index / 64);
    const bitIndex = index % 64;
    return bitmap[bitmapIndex].testn(bitIndex);
}