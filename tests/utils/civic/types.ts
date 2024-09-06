import { web3 } from "@coral-xyz/anchor";
import { GatekeeperNetworkService, GatekeeperService } from "@identity.com/solana-gatekeeper-lib";
import { TestEnvironment } from "../environment/test-environment";

export interface CivicConfig {
    gatekeeperNetwork: web3.Keypair;
    gatekeeper: web3.Keypair; // Needs to be funded
    gknService: GatekeeperNetworkService;
    gkService: GatekeeperService;
}

export interface GatewayAuthorizeAccount {
    testEnv: TestEnvironment,
    account: web3.PublicKey
}