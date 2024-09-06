import { web3 } from "@coral-xyz/anchor";
import { GatekeeperConfig, GatekeeperService } from "@identity.com/solana-gatekeeper-lib";
import { GatekeeperNetworkService } from "@identity.com/solana-gatekeeper-lib";
import { CivicConfig } from "./types";
import { TestEnvironment } from "../environment/test-environment";

export function setupCivcPass(connection: web3.Connection, config?: GatekeeperConfig): CivicConfig {
    const gatekeeperNetwork = web3.Keypair.generate();
    const gatekeeper = web3.Keypair.generate();

    const gknService = new GatekeeperNetworkService(
        connection,
        gatekeeperNetwork
    );

    const gkService = new GatekeeperService(
        connection,
        gatekeeperNetwork.publicKey,
        gatekeeper,
        config
    );

    return {
        gatekeeperNetwork,
        gatekeeper,
        gknService,
        gkService,
    };
}

export async function addGateKeeper(testEnv: TestEnvironment) {
    const { connection } = testEnv.provider;
    const { gknService, gatekeeper, gatekeeperNetwork } = testEnv.civicConfig;
    const addGatekeeperIx = await gknService.addGatekeeper(gatekeeper.publicKey);
    const tx = addGatekeeperIx.transaction;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = testEnv.authority.publicKey;
    const txId = await web3.sendAndConfirmTransaction(
        connection,
        tx,
        [testEnv.authority, gatekeeperNetwork],
        { commitment: 'processed', skipPreflight: true }
    );
    return txId;
}