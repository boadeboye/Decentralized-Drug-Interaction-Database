# 🔒 Decentralized Drug Interaction Database

Welcome to a revolutionary Web3 solution for managing drug interaction data! This project creates a tamper-proof, decentralized API on the Stacks blockchain using Clarity smart contracts. It addresses the real-world problem of unreliable or manipulable drug interaction databases in healthcare, where outdated or tampered information can lead to dangerous medical errors. By leveraging blockchain, we ensure immutable records, transparent updates only from verified experts, and open access for queries, reducing risks in prescribing and patient care.

## ✨ Features

🔍 Query drug interactions via smart contract calls  
🛡️ Tamper-proof storage of interaction data  
✅ Expert verification and gated updates  
📈 Versioned history for all database changes  
🚀 Decentralized governance for approving major updates  
📝 Support for adding new drugs and interactions  
🔐 Access controls to prevent unauthorized modifications  
⏱️ Timestamps for all entries and updates  
🔗 Integration-friendly API-like interface through contract functions  
🚫 Duplicate prevention and data integrity checks  

## 🛠 How It Works

This project consists of 8 interconnected Clarity smart contracts that form a robust decentralized system. Experts (e.g., pharmacists, doctors, or researchers) must first verify their credentials to contribute. Updates are proposed, reviewed, and immutably recorded, while anyone can query the database without permission.

### Key Smart Contracts

1. **ExpertRegistry.clar**: Manages expert verification. Handles registration, credential submission (e.g., via off-chain proofs hashed on-chain), and revocation. Uses a mapping of principals to verification status.

2. **DrugRegistry.clar**: Stores basic drug information. Allows verified experts to add new drugs with unique IDs, names, categories, and hashes of detailed specs. Prevents duplicates via hash checks.

3. **InteractionDatabase.clar**: Core storage for drug interactions. Maps pairs of drug IDs to interaction details (severity, description, effects). Ensures data immutability once added.

4. **UpdateProposal.clar**: Enables experts to propose changes, such as new interactions or updates to existing ones. Proposals include justifications and are stored with timestamps.

5. **GovernanceVoting.clar**: Facilitates community or expert-only voting on proposals. Uses a simple token-based or stake-weighted system to approve/reject updates, ensuring consensus.

6. **AuditLog.clar**: Logs all actions (registrations, additions, updates) in an immutable append-only structure. Provides query functions for tracing changes.

7. **AccessControl.clar**: Defines roles and permissions. Integrates with ExpertRegistry to enforce who can call update functions across other contracts.

8. **QueryAPI.clar**: Acts as a facade for read operations. Provides helper functions to fetch drug details, interactions, and histories in a user-friendly way, simulating an API endpoint.

### For Experts (Contributors)

- Verify yourself: Call `register-expert` in ExpertRegistry with your credential hash.
- Add a drug: Use `add-drug` in DrugRegistry with name, category, and spec hash.
- Propose an interaction: Submit via `create-proposal` in UpdateProposal, specifying drug pairs, severity, and description.
- Vote on proposals: Participate in `vote-on-proposal` in GovernanceVoting to approve changes.
- Once approved, the update is applied to InteractionDatabase, and logged in AuditLog.

Your contributions are now permanently secured on the blockchain!

### For Users (Queriers)

- Fetch drug info: Call `get-drug-details` in DrugRegistry or QueryAPI.
- Check interactions: Use `get-interaction` in InteractionDatabase with two drug IDs.
- View history: Query `get-log-entries` in AuditLog for transparency.

That's it! Reliable, decentralized access to critical drug data, helping prevent adverse interactions in real-time applications like health apps or EHR systems.