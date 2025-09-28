import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, buffCV, boolCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_DRUG_ID = 101;
const ERR_INVALID_SEVERITY = 102;
const ERR_INVALID_DESCRIPTION = 103;
const ERR_INVALID_EFFECTS = 104;
const ERR_INVALID_RECOMMENDATIONS = 105;
const ERR_INTERACTION_ALREADY_EXISTS = 106;
const ERR_INTERACTION_NOT_FOUND = 107;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_INVALID_SOURCE_HASH = 110;
const ERR_INVALID_VERSION = 111;
const ERR_INVALID_INTERACTION_TYPE = 115;
const ERR_INVALID_ONSET = 117;
const ERR_INVALID_DURATION = 118;
const ERR_INVALID_EVIDENCE_LEVEL = 119;
const ERR_MAX_INTERACTIONS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;

interface Interaction {
  severity: number;
  description: string;
  effects: string;
  recommendations: string;
  sourceHash: Uint8Array;
  timestamp: number;
  creator: string;
  interactionType: string;
  contraindication: boolean;
  onset: number;
  duration: number;
  evidenceLevel: number;
  status: boolean;
  version: number;
}

interface InteractionUpdate {
  updateSeverity: number;
  updateDescription: string;
  updateTimestamp: number;
  updater: string;
  updateVersion: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class InteractionDatabaseMock {
  state: {
    nextInteractionId: number;
    maxInteractions: number;
    updateFee: number;
    authorityContract: string | null;
    interactions: Map<string, Interaction>;
    interactionUpdates: Map<string, InteractionUpdate>;
    interactionsByHash: Map<string, { drug1: number; drug2: number }>;
  } = {
    nextInteractionId: 0,
    maxInteractions: 100000,
    updateFee: 100,
    authorityContract: null,
    interactions: new Map(),
    interactionUpdates: new Map(),
    interactionsByHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextInteractionId: 0,
      maxInteractions: 100000,
      updateFee: 100,
      authorityContract: null,
      interactions: new Map(),
      interactionUpdates: new Map(),
      interactionsByHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  private getKey(drug1: number, drug2: number): string {
    const min = Math.min(drug1, drug2);
    const max = Math.max(drug1, drug2);
    return `${min}-${max}`;
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setUpdateFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.updateFee = newFee;
    return { ok: true, value: true };
  }

  addInteraction(
    drug1: number,
    drug2: number,
    severity: number,
    description: string,
    effects: string,
    recommendations: string,
    sourceHash: Uint8Array,
    interactionType: string,
    contraindication: boolean,
    onset: number,
    duration: number,
    evidenceLevel: number,
    version: number
  ): Result<boolean> {
    if (this.state.nextInteractionId >= this.state.maxInteractions) return { ok: false, value: ERR_MAX_INTERACTIONS_EXCEEDED };
    if (drug1 <= 0 || drug2 <= 0) return { ok: false, value: ERR_INVALID_DRUG_ID };
    if (severity < 0 || severity > 2) return { ok: false, value: ERR_INVALID_SEVERITY };
    if (!description || description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!effects || effects.length > 1000) return { ok: false, value: ERR_INVALID_EFFECTS };
    if (recommendations.length > 500) return { ok: false, value: ERR_INVALID_RECOMMENDATIONS };
    if (sourceHash.length !== 32) return { ok: false, value: ERR_INVALID_SOURCE_HASH };
    if (!["pharmacokinetic", "pharmacodynamic", "unknown"].includes(interactionType)) return { ok: false, value: ERR_INVALID_INTERACTION_TYPE };
    if (onset < 0) return { ok: false, value: ERR_INVALID_ONSET };
    if (duration < 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (evidenceLevel < 0 || evidenceLevel > 5) return { ok: false, value: ERR_INVALID_EVIDENCE_LEVEL };
    if (version <= 0) return { ok: false, value: ERR_INVALID_VERSION };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const key = this.getKey(drug1, drug2);
    if (this.state.interactions.has(key)) return { ok: false, value: ERR_INTERACTION_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.updateFee, from: this.caller, to: this.state.authorityContract });

    const interaction: Interaction = {
      severity,
      description,
      effects,
      recommendations,
      sourceHash,
      timestamp: this.blockHeight,
      creator: this.caller,
      interactionType,
      contraindication,
      onset,
      duration,
      evidenceLevel,
      status: true,
      version,
    };
    this.state.interactions.set(key, interaction);
    this.state.interactionsByHash.set(new TextDecoder().decode(sourceHash), { drug1, drug2 });
    this.state.nextInteractionId++;
    return { ok: true, value: true };
  }

  getInteraction(drug1: number, drug2: number): Interaction | null {
    return this.state.interactions.get(this.getKey(drug1, drug2)) || null;
  }

  updateInteraction(
    drug1: number,
    drug2: number,
    updateSeverity: number,
    updateDescription: string,
    updateVersion: number
  ): Result<boolean> {
    const key = this.getKey(drug1, drug2);
    const interaction = this.state.interactions.get(key);
    if (!interaction) return { ok: false, value: false };
    if (interaction.creator !== this.caller) return { ok: false, value: false };
    if (updateSeverity < 0 || updateSeverity > 2) return { ok: false, value: false };
    if (!updateDescription || updateDescription.length > 500) return { ok: false, value: false };
    if (updateVersion <= interaction.version) return { ok: false, value: false };

    const updated: Interaction = {
      ...interaction,
      severity: updateSeverity,
      description: updateDescription,
      timestamp: this.blockHeight,
      version: updateVersion,
    };
    this.state.interactions.set(key, updated);
    this.state.interactionUpdates.set(key, {
      updateSeverity,
      updateDescription,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateVersion,
    });
    return { ok: true, value: true };
  }

  getInteractionCount(): Result<number> {
    return { ok: true, value: this.state.nextInteractionId };
  }

  checkInteractionExistence(drug1: number, drug2: number): Result<boolean> {
    return { ok: true, value: this.state.interactions.has(this.getKey(drug1, drug2)) };
  }
}

describe("InteractionDatabase", () => {
  let contract: InteractionDatabaseMock;

  beforeEach(() => {
    contract = new InteractionDatabaseMock();
    contract.reset();
  });

  it("adds an interaction successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash = new Uint8Array(32).fill(1);
    const result = contract.addInteraction(
      1,
      2,
      1,
      "Moderate interaction",
      "Dizziness and nausea",
      "Monitor closely",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const interaction = contract.getInteraction(1, 2);
    expect(interaction?.severity).toBe(1);
    expect(interaction?.description).toBe("Moderate interaction");
    expect(interaction?.effects).toBe("Dizziness and nausea");
    expect(interaction?.recommendations).toBe("Monitor closely");
    expect(interaction?.interactionType).toBe("pharmacokinetic");
    expect(interaction?.contraindication).toBe(false);
    expect(interaction?.onset).toBe(60);
    expect(interaction?.duration).toBe(3600);
    expect(interaction?.evidenceLevel).toBe(3);
    expect(interaction?.version).toBe(1);
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate interactions", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash = new Uint8Array(32).fill(1);
    contract.addInteraction(
      1,
      2,
      1,
      "Moderate interaction",
      "Dizziness and nausea",
      "Monitor closely",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    const result = contract.addInteraction(
      1,
      2,
      2,
      "Major interaction",
      "Severe effects",
      "Avoid use",
      new Uint8Array(32).fill(2),
      "pharmacodynamic",
      true,
      30,
      7200,
      4,
      2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INTERACTION_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const sourceHash = new Uint8Array(32).fill(1);
    const result = contract.addInteraction(
      1,
      2,
      1,
      "Moderate interaction",
      "Dizziness and nausea",
      "Monitor closely",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects addition without authority contract", () => {
    const sourceHash = new Uint8Array(32).fill(1);
    const result = contract.addInteraction(
      1,
      2,
      1,
      "Moderate interaction",
      "Dizziness and nausea",
      "Monitor closely",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid severity", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash = new Uint8Array(32).fill(1);
    const result = contract.addInteraction(
      1,
      2,
      3,
      "Invalid severity",
      "Effects",
      "Recs",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SEVERITY);
  });

  it("rejects invalid drug ID", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash = new Uint8Array(32).fill(1);
    const result = contract.addInteraction(
      0,
      2,
      1,
      "Description",
      "Effects",
      "Recs",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DRUG_ID);
  });

  it("rejects invalid interaction type", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash = new Uint8Array(32).fill(1);
    const result = contract.addInteraction(
      1,
      2,
      1,
      "Description",
      "Effects",
      "Recs",
      sourceHash,
      "invalid",
      false,
      60,
      3600,
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_INTERACTION_TYPE);
  });

  it("updates an interaction successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash = new Uint8Array(32).fill(1);
    contract.addInteraction(
      1,
      2,
      1,
      "Old description",
      "Effects",
      "Recs",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    const result = contract.updateInteraction(1, 2, 2, "New description", 2);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const interaction = contract.getInteraction(1, 2);
    expect(interaction?.severity).toBe(2);
    expect(interaction?.description).toBe("New description");
    expect(interaction?.version).toBe(2);
    const update = contract.state.interactionUpdates.get(contract.getKey(1, 2));
    expect(update?.updateSeverity).toBe(2);
    expect(update?.updateDescription).toBe("New description");
    expect(update?.updateVersion).toBe(2);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent interaction", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateInteraction(1, 2, 2, "New description", 2);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-creator", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash = new Uint8Array(32).fill(1);
    contract.addInteraction(
      1,
      2,
      1,
      "Description",
      "Effects",
      "Recs",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateInteraction(1, 2, 2, "New description", 2);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets update fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setUpdateFee(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.updateFee).toBe(200);
    const sourceHash = new Uint8Array(32).fill(1);
    contract.addInteraction(
      1,
      2,
      1,
      "Description",
      "Effects",
      "Recs",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    expect(contract.stxTransfers).toEqual([{ amount: 200, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects update fee change without authority contract", () => {
    const result = contract.setUpdateFee(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct interaction count", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash1 = new Uint8Array(32).fill(1);
    const sourceHash2 = new Uint8Array(32).fill(2);
    contract.addInteraction(
      1,
      2,
      1,
      "Desc1",
      "Eff1",
      "Rec1",
      sourceHash1,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    contract.addInteraction(
      3,
      4,
      2,
      "Desc2",
      "Eff2",
      "Rec2",
      sourceHash2,
      "pharmacodynamic",
      true,
      30,
      7200,
      4,
      1
    );
    const result = contract.getInteractionCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks interaction existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash = new Uint8Array(32).fill(1);
    contract.addInteraction(
      1,
      2,
      1,
      "Description",
      "Effects",
      "Recs",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    const result = contract.checkInteractionExistence(1, 2);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkInteractionExistence(3, 4);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects addition with empty description", () => {
    contract.setAuthorityContract("ST2TEST");
    const sourceHash = new Uint8Array(32).fill(1);
    const result = contract.addInteraction(
      1,
      2,
      1,
      "",
      "Effects",
      "Recs",
      sourceHash,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DESCRIPTION);
  });

  it("rejects addition with max interactions exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxInteractions = 1;
    const sourceHash1 = new Uint8Array(32).fill(1);
    contract.addInteraction(
      1,
      2,
      1,
      "Desc1",
      "Eff1",
      "Rec1",
      sourceHash1,
      "pharmacokinetic",
      false,
      60,
      3600,
      3,
      1
    );
    const sourceHash2 = new Uint8Array(32).fill(2);
    const result = contract.addInteraction(
      3,
      4,
      2,
      "Desc2",
      "Eff2",
      "Rec2",
      sourceHash2,
      "pharmacodynamic",
      true,
      30,
      7200,
      4,
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_INTERACTIONS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});