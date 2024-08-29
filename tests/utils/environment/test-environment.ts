import * as anchor from '@coral-xyz/anchor';
import { Distributor } from "../../../target/types/distributor";

export class TestEnvironment {
    provider: anchor.AnchorProvider;
    program: anchor.Program<Distributor>;

    pyUsdMint: anchor.web3.PublicKey;
    pyUsdMintAuthorityKeypair: anchor.web3.Keypair;

    authority1: anchor.web3.Keypair;
    tokenSource1: anchor.web3.PublicKey;

    // TODO: Add Merkle Stuff

    constructor() {
        this.authority1 = anchor.web3.Keypair.generate();
        this.pyUsdMintAuthorityKeypair = anchor.web3.Keypair.generate();
    }
}