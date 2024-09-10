# Dispatch

Dispatch is a powerful Solana-based tool designed for efficient and secure distribution of PYUSD to many recipients for applications such as:
- Universal Basic Income (UBI)
- Class Action Settlements
- Rewards/Rebate Programs
- and more!

It is our belief that the speed of Solana, the reach/community of Venmo and PayPal, ID Verification by Civic, and more, 
create a uniquely cost-effective, efficient, and scalable solution for distributing cash to a large number of recipients.

## Contents
- [PYUSD Hackathon Submission](#pyusd-hackathon-submission)
- [Local Deployment](#local-deployment)
- [Architecture](#architecture)
- [Acknowledgements](#acknowledgements)
- [Contact](#contact)

## PYUSD Hackathon Submission
Submission to [2024 Global PYUSD Portal Hackathon](https://pyusd.portalhq.io/).

### Team
- Aaron Milano (amilz) ([GitHub](https://github.com/amilz), [LinkedIn](https://www.linkedin.com/in/aaronmilano/))

### Features

- **Efficient Distribution**: Quickly distribute PYUSD to thousands or millions of recipients.
- **Flexible Claiming**: Supports both admin-paid (e.g., bulk airdrop) and user-paid (e.g., individual claims)  structures.
- **Secure Verification**: Utilizes on-chain merkle roots and bitmap tracking for distribution/claim verification.
- **Account Verification**: Integrates with [Civic On-chain Gateway](https://github.com/identity-com/on-chain-identity-gateway) for enhanced security and compliance.
- **Scalable**: Designed to handle large-scale distributions with expandable distribution trees.
- **Pausable**: Allows pausing and resuming of distributions for added control.
- **Reclaim Functionality**: Enables administrative cancellation and reclaiming of funds when necessary.
- **Tiered Fees**: Supports payment to a program fees wallet based on aggregate size of an authority's distribution tree.

### Project Scope and Goals

The submission to this hackathon aimed to develop a robust and scalable solution for distributing PYUSD to a large number of recipients at a low cost, while maintaining the ability to securely verify and track claims. The project scope includes a Solana Program (rust) and tests (TypeScript) that:
- Merkle tree creation and on-chain storage
- Developing an on-chain bitmap tracking system for efficient claim verification
- Integrating with Civic's On-chain Gateway for user verification
- Expandable distribution trees for scalability
- Admin-paid distribution and user-paid claim structures
- Reclaim functionality for administrative cancellation
- Expandable to expand distribution tree accounts to support Solana's limitations on account space initialization and reallocation

Out of scope for this submission, but planned for future roadmap:
- U.I. for Authority/Administrative Dashboard (e.g., Initialize, Auth Rules, Expand, Pause, Reclaim, etc.)
- U.I. for User Dashboard (e.g., Enroll, Authorize, Claim, etc.)
- Off-ramp via PayPal/Venmo
- [Custom Pass](https://docs.civic.com/integration-guides/custom-pass) setup for authorities to supply their own identiy verification requirements

### General User Flow
- **Authority** is the creator/administrator of a PYUSD bulk distribution
- **Recipient** is a user who will receive or claim PYUSD from a distribution

| Step | Party | On or Off Chain |  Action | In Scope for Hackathon Submission |
| --- | --- | --- | --- | --- |
| 1 | Authority | Off | (optional) Create rules for user verification | - |
| 2 | Recipient | Both | Enroll their public key with Authority  and (optional) Perform user verification | (arbitrary verification) |
| 3 | Authority | Off | Create a list of recipients and the amount of funds to distribute to each recipient | (ranomly generated) |
| 4 | Authority | Off | Create a merkle root of the off-chain list of recipients and the amount of funds to distribute to each recipient | ✅ |
| 5 | Authority | On | `initialize` Distribution Tree: store proof on chain and transfer funds to the token vault | ✅ |
| 6 | Authority | On | (if necessary) `expand_distribution_tree`  to ensure adequate space for bitmap tracking | ✅ |
| 7 | Authority | On | (if necessary) `pause`, `resume` or `cancel` the Distribution Tree to pause distributions | ✅ |
| 8a | Recipient | On | `claim` funds from the distribution if allowed | ✅ |
| 8b | Authority | On | `distribute` funds to recipients | ✅ |
| 9 | Authority | On | `reclaim` rent from the bitmap tracker in PDA after distribution is complete | ✅ |
| 10 | Authority | On | (if necessary) `close` the Distribution Tree to reclaim rent | ✅ |
| 11 | Recipient | Both | User uses funds on-chain or off-ramps to PayPal/Venmo | - |

### Distribution Tree Initialization

- "Authority" creates an off-chain list of recipients and the amount of funds to distribute to each recipient
- "Authority" creates a merkle root of the off-chain list of recipients and the amount of funds to distribute to each recipient
- "Authority" runs the program 
 distribution tree account with the following parameters:

### Tech Stack
- [Anchor](anchor-lang.com): [Dispatch Program](programs/cash-dispatch) for the on-chain creation and management of distribution trees
- [TypeScript](https://www.typescriptlang.org/): [Program Test Suite](tests)
- Optional User Verification: [Civc Identity.com On-chain Gateway](https://github.com/identity-com/on-chain-identity-gateway)

## Local Deployment
The Dispatch program is not yet deployed on any public Solana cluster. To test locally, you can use the following steps:
Note: for local testing, we are using a simulated PYUSD token, `PyuSdRak7SLogVeLcj8tgAk1JCJvHpfZ9R5keq25BkS`. 

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (latest stable version)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable version)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (> v1.18)
- [Anchor CLI](https://www.anchor-lang.com/) (> v0.30.1)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/cash-dispatch.git
   cd cash-dispatch
   ```

2. Install dependencies:
   ```
   yarn
   ```

3. Build the project:
   ```
   anchor build
   ```
   You may need to run `anchor keys sync` to make sure that your local program keys match `declare_id!` in the `programs/cash-dispatch/src/lib.rs` file.

4. Run all tests:
   ```
   anchor test
   ```

For more detailed instructions on each operation, please refer to the [Documentation](#documentation) section.

## Architecture

Dispatch is built on the Solana blockchain and uses the Anchor framework. Key components include:

- Distribution Tree PDA: Manages the state of each distribution.
- Merkle Root: Ensures secure and efficient verification of claims.
- Bitmap Tracking: Efficiently tracks which recipients have claimed their funds.
- Civic Integration: Provides account verification for enhanced security.

### Distribution Tree

_[programs/cash-dispatch/src/state/distribution_tree.rs](programs/cash-dispatch/src/state/distribution_tree.rs)_

The `DistributionTree` Account is the only stateful account in the Dispatch program. It is responsible for managing the distribution of funds to recipients. The account includes:
- **bump**: A bump seed used to derive the PDA for the DistributionTree.
- **version**: A version number for the DistributionTree.
- **authority**: The authority of the DistributionTree.
- **batch_id**: A unique identifier for the batch of recipients.
- **recipients_distributed_bitmap**: A bitmap that tracks which recipients have claimed their funds.
- **status**: The status of the DistributionTree.
- **allow_claims**: Whether or not individual recipients can claim their tokens.
- **merkle_root**: The root of the Merkle tree of the tree of recipients and amounts.
- **mint**: The token to be distributed.
- **token_vault**: The token vault for the token to be distributed.
- **total_number_recipients**: The total number of recipients in the distribution.
- **number_distributed**: The number of recipients distributed.
- **start_ts**: The start timestamp of the distribution.
- **end_ts**: The end timestamp of the distribution.
- **gatekeeper_network**: (optional) The network of the Civic On-chain Gateway.

### Merkle Root

Program Verification: _[programs/cash-dispatch/src/utils.rs](programs/cash-dispatch/src/utils.rs)_

Test Creation: _[tests/utils/merkle-tree/index.ts](tests/utils/merkle-tree/index.ts)_

The Merkle Root is derived from the index, user public key, and amount to be distributed to the recipient. The Merkle Root is used to verify the distribution of funds to a recipient along with a client-generated proof.

### Understanding the Recipients Distributed Bitmap

The `recipients_distributed_bitmap` is a crucial element in our Dispatch system that efficiently tracks which recipients have claimed their funds. Here's a visual representation to help understand how it works:

```
recipients_distributed_bitmap: [u64; N]

[0000000000000000000000000000000000000000000000000000000000000000] <- u64 #1
[0000000000000000000000000000000000000000000000000000000000000000] <- u64 #2
[0000000000000000000000000000000000000000000000000000000000000000] <- u64 #3
...
[0000000000000000000000000000000000000000000000000000000000000000] <- u64 #N
```

Each `u64` in the array represents 64 recipients:
- `0` means the recipient hasn't claimed their funds
- `1` means the recipient has claimed their funds

For example, if the first three recipients claim their funds:

```
[1110000000000000000000000000000000000000000000000000000000000000] <- u64 #1
[0000000000000000000000000000000000000000000000000000000000000000] <- u64 #2
...
```

Key Considerations:
- Each bit corresponds to a unique recipient
- The array expands as needed to accommodate all recipients (this is required to be done over multiple instructions due to limitations of Solana's account initialization and reallocation size)
- This method allows for efficient storage and quick lookup
- We can track up to 64 recipients with each `u64` element

This bitmap approach significantly reduces storage requirements and improves performance when managing large-scale distributions. After a distribution is completed, the recipients distributed bitmap can be cleared up to reclaim storage.

### Civic Identity.com On-chain Authentication

_[tests/instructions/7-gatekeeper/gatekeeperTests.ts](tests/instructions/7-gatekeeper/gatekeeperTests.ts)_

[Civic Pass](https://docs.civic.com/integration-guides/civic-pass) allows users to verify identity associated with a public key. This demonstration utilizes a simple local version of the Gateway Newtork to show how an additional layer of verification can be required on- or off-chain as a part of a distribution or claim process. In production, we aim to allow authorities to supply their own custom verification requirements via a [Custom Pass](https://docs.civic.com/integration-guides/custom-pass).


## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

- [PayPal](https://www.paypal.com/) and [Portal](https://www.portalhq.io/) for organizing the Global PYUSD Portal Hackathon
- [Saber](https://github.com/saber-hq/merkle-distributor) for providing a great demonstration of Merkle Tree distributions

## Contact

For questions or support, please open an issue in this repository or contact us at [amilz1@protonmail.com].
